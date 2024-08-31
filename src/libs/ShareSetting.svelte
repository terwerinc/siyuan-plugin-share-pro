<script lang="ts">
    import ShareProPlugin from "../index"
    import {Dialog, showMessage} from "siyuan"
    import {ShareProConfig} from "../models/ShareProConfig"
    import {SHARE_PRO_STORE_NAME} from "../Constants"
    import {onMount} from "svelte"
    import {KeyInfo} from "../models/KeyInfo"
    import {getRegisterInfo} from "../utils/LicenseUtils";

    export let pluginInstance: ShareProPlugin
    export let dialog: Dialog
    export let vipInfo: {
        code: number
        msg: string
        data: KeyInfo
    }

    let settingConfig: ShareProConfig = {
        serviceApiConfig: {
            token: "",
        },
    }

    const onSaveSetting = async () => {
        await pluginInstance.saveData(SHARE_PRO_STORE_NAME, settingConfig)
        // showMessage(`${pluginInstance.i18n.settingConfigSaveSuccess}`, 2000, "info")
        dialog.destroy()
    }

    const onCancel = async () => {
        dialog.destroy()
    }

    onMount(async () => {
        settingConfig = await pluginInstance.safeLoad<ShareProConfig>(SHARE_PRO_STORE_NAME)
    })
</script>

<div>
    <div class="config__tab-container">
        {#if vipInfo.code === 1}
            <div class="fn__block form-item no-register">注册码不合法或尚未注册</div>
        {:else}
            <div class="fn__block form-item registered">
                <span>已注册[{vipInfo.data.isVip ? "vip" : "普通用户"}]， </span>
                <span>注册给：{vipInfo.data.email}，</span>
                <span>注册类型: {getRegisterInfo(vipInfo.data.payType)}，</span>
                <span>有效期：{vipInfo.data.num >= 999 ? "永久" : vipInfo.data.num}， </span>
                <span>注册时间：{vipInfo.data.from}</span>
            </div>
        {/if}

        <div class="fn__block form-item">
            注册码
            <div class="b3-label__text form-item-tip">
                完整的注册码，可
                <a class="fn__code" href="https://store.terwer.space/products/share-pro">点击这里</a>
                自助获取，或者发邮件到 youweics@163.com 申请试用
            </div>
            <span class="fn__hr"/>
            <textarea
                    class="b3-text-field fn__block"
                    id="regCode"
                    bind:value={settingConfig.serviceApiConfig.token}
                    rows="5"
                    placeholder="请输入注册码"
            />
        </div>

        <div class="b3-dialog__action">
            <button class="b3-button b3-button--cancel" on:click={onCancel}>{pluginInstance.i18n.cancel}</button>
            <div class="fn__space"/>
            <button class="b3-button b3-button--text" on:click={onSaveSetting}>{pluginInstance.i18n.save}</button>
        </div>
    </div>
</div>

<style>
    .form-item {
        padding: 20px 10px;
        width: 94%;
        margin: auto;
        font-size: 14px;
    }

    .form-item-tip {
        font-size: 12px !important;
        color: var(--b3-theme-on-background);
    }

    .no-register {
        color: red !important;
        padding-bottom: 0;
    }

    .registered {
        color: green !important;
        padding-bottom: 0;
    }
</style>
