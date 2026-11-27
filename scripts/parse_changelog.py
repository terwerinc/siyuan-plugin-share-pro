import re
import shutil


def parse_changelog():
    """
    :robot: A new release will be created
    ---


    ## 1.0.0 (2023-04-24)


    ### ⚠ BREAKING CHANGES

    * **esbuild-config-custom:** previews esbuild config need to be a attr value for esbuild property, add a new customConfig property

    ### Features

    * [#163](https://github.com/terwer/zhi/issues/163) ([d9fae8a](https://github.com/terwer/zhi/commit/d9fae8af6f96052a82e62f9aea79505a52fdbb23))
    * Add a vuepress 2 blog ([9862b18](https://github.com/terwer/zhi/commit/9862b1811663a2b34b05d140d3197075d943696b))
    * add api docs ([97751dc](https://github.com/terwer/zhi/commit/97751dc63b6ed9143a9d6eb0d673a22d4f9c9f6a))
    * add api docs ([3b5ff6f](https://github.com/terwer/zhi/commit/3b5ff6fbb1ab3ea161e41d0436037e85e4a6cee3))
    * add api docs ([b338a67](https://github.com/terwer/zhi/commit/b338a67268e767b9289a8d768377c5cd8ce29fbe))
    * add api docs ([6f9ebd9](https://github.com/terwer/zhi/commit/6f9ebd939c8bdabc5e2e377feb13363dc0dbe769))
    * Add api docs ([9c1a5e5](https://github.com/terwer/zhi/commit/9c1a5e5036c3d95d050e4672df5f505386d29962))
    """

    # will print

    """
    :robot: a new release will be created
    ---

    ## 1.0.0 (2023-04-24)
    ### ⚠ BREAKING CHANGES
    * **esbuild-config-custom:** previews esbuild config need to be a attr value for esbuild property, add a new customconfig property
    ### Features
    * [#163](https://github.com/terwer/zhi/issues/163) ([d9fae8a](https://github.com/terwer/zhi/commit/d9fae8af6f96052a82e62f9aea79505a52fdbb23))
    * add a vuepress 2 blog ([9862b18](https://github.com/terwer/zhi/commit/9862b1811663a2b34b05d140d3197075d943696b))
    * add api docs ([9c1a5e5](https://github.com/terwer/zhi/commit/9c1a5e5036c3d95d050e4672df5f505386d29962))

    """

    # make a backup copy of the original file
    original_file = 'CHANGELOG.md'
    # backup_file = original_file.replace(".md", "_backup.md")
    # shutil.copyfile(original_file, backup_file)

    # handle repeat lines
    with open(original_file, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f.readlines()]
    unique_commits = remove_same_commit(lines)

    # save new file
    save_file = original_file
    with open(save_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(unique_commits) + '\n')
    print(f"comment parsed.saved to => {save_file}")


def remove_same_commit(commit_list):
    """
    去掉重复的提交行，标题、空行等非提交行原样保留
    """
    result = []
    seen = set()
    for line in commit_list:
        # 只对提交条目去重，标题、空行等原样保留
        if not line.startswith('* '):
            result.append(line)
            continue

        # 先匹配常规的
        match = re.search(r'(?<=\*\s).*?(?=\()', line)
        if match:
            title = match.group(0).strip()
        else:
            # 接下来匹配有模块的
            match2 = re.search(r'[*] [**](.*)[**] ([^:]+): (.*) \((.*)\)', line)
            if match2:
                title = match2.group(3).strip()
            else:
                # 最后处理剩下的
                title = line

        # 去重时忽略大小写，但保留原始行文本
        key = title.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(line)

    return result


if __name__ == "__main__":
    parse_changelog()