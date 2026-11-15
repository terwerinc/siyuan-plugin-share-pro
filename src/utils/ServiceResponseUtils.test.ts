import {describe,it,expect} from "vitest"
import {normalizeServiceResponse,resolveHostedMode} from "./ServiceResponseUtils"
import en from "../i18n/en_US.json"
import zh from "../i18n/zh_CN.json"
describe("service response contract",()=>{
  it.each([undefined,{}, {hostedMode:null}, {hostedMode:"false"}, {hostedMode:true}])("uses hosted compatibility default for %j",r=>{expect(resolveHostedMode(r)).toBe(true)})
  it("accepts only an explicit boolean false",()=>expect(resolveHostedMode({hostedMode:false})).toBe(false))
  it("localizes a stable code and retains old fields as compatibility data",()=>{
    const source={code:403,errorCode:'AUTH_REQUIRED',hostedMode:false,msg:'long server message',message:'legacy message',errMsg:'old errMsg',data:'{}'}
    const a=normalizeServiceResponse(source,en.serviceErrors,'/api/license/vipInfo'),b=normalizeServiceResponse(source,zh.serviceErrors,'/api/license/vipInfo')
    expect(a.msg).toBe(en.serviceErrors.AUTH_REQUIRED);expect(b.msg).toBe(zh.serviceErrors.AUTH_REQUIRED)
    expect(a).toMatchObject({code:403,errorCode:'AUTH_REQUIRED',hostedMode:false,message:'legacy message',errMsg:'old errMsg',data:'{}',legacyMessage:'long server message'})
    expect(source.msg).toBe('long server message')
  })
  it("uses a local generic message for unknown future codes",()=>{
    expect(normalizeServiceResponse({code:1,errorCode:'FUTURE_ERROR',msg:'untrusted copy'},zh.serviceErrors).msg).toBe(zh.serviceErrors.UNKNOWN_ERROR)
  })
  it("does not parse Chinese messages to classify legacy failures",()=>{
    const a=normalizeServiceResponse({code:403,msg:'anything'},en.serviceErrors,'/api/license/vipInfo')
    const b=normalizeServiceResponse({code:403,msg:'其他语言'},en.serviceErrors,'/api/license/vipInfo')
    expect(a.errorCode).toBe(b.errorCode);expect(a.hostedMode).toBe(true)
  })
  it("preserves raw settings and nested document JSON",()=>{
    const raw={domain:'https://reader.example.test',code:123}
    expect(normalizeServiceResponse(raw,en.serviceErrors,'/api/settings/byAuthor')).toBe(raw)
    const json='{"post":"unchanged"}'
    expect(normalizeServiceResponse({code:0,data:json},en.serviceErrors).data).toBe(json)
  })
})
