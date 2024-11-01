<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->
<script lang="ts">
    import ShareProPlugin from "../index";
    import {KeyInfo} from "../models/KeyInfo";

    export let pluginInstance: ShareProPlugin
    export let keyInfo: KeyInfo
</script>

<div>
    Share manage

    {JSON.stringify(keyInfo)}
</div>