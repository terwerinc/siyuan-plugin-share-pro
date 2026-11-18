import os

import scriptutils

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
# 与思源集市 rules/images.go 的限制保持一致
MAX_IMAGE_BYTES = {"icon.png": 64 * 1024, "preview.png": 512 * 1024}

if __name__ == "__main__":
    # 切换工作空间
    scriptutils.switch_workdir()

    # 获取当前工作空间
    cwd = scriptutils.get_workdir()

    dist_folder = "./dist"
    data = scriptutils.read_json_file(cwd + "package.json")
    v = data["version"]

    src_folder = dist_folder
    tmp_folder_name = "./share-pro"
    build_zip_path = "./build"
    build_zip_name = "share-pro-" + v + ".zip"

    # 扩展名必须和实际格式一致，否则插件市场索引会失败
    for asset in ("icon.png", "preview.png"):
        asset_path = os.path.join(src_folder, asset)
        with open(asset_path, "rb") as f:
            if f.read(8) != PNG_SIGNATURE:
                raise SystemExit(f"打包错误: {asset_path} 扩展名是 .png，但内容不是 PNG")
        limit = MAX_IMAGE_BYTES[asset]
        size = os.path.getsize(asset_path)
        if size > limit:
            raise SystemExit(f"打包错误: {asset_path} 大小为 {size} 字节，超过 {limit} 字节上限")

    try:
        # 压缩dist为zip
        scriptutils.zip_folder(src_folder, tmp_folder_name, build_zip_path, build_zip_name)
        scriptutils.cp_file(os.path.join(build_zip_path, build_zip_name), os.path.join(build_zip_path, "package.zip"))
    except Exception as e:
        print(f"打包错误,{str(e)}")
    print("插件打包完毕.")
