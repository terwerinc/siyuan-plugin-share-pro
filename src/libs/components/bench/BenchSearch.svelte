<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script>
  export let searchTerm
  export let classSearch = "bench-search"
  export let searchPlaceholder = "Type a keyword..."
</script>

<bench-search>
  <div class={classSearch}>
    <input
      type="search"
      placeholder={searchPlaceholder}
      aria-label={searchPlaceholder}
      bind:value={searchTerm}
      on:input
    />
  </div>
</bench-search>

<style>
  bench-search {
    grid-area: bench-search;
  }

  .bench-search {
    margin-bottom: 6px;
  }
  .bench-search input {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-color: #fff;
    border: 1px solid #d2d6dc;
    border-radius: 5px;
    line-height: 1.2rem;
    outline: none;
    padding: 0.4rem 1rem;
    width: 250px;
  }

  /* 适配暗黑模式 */
  :global(html[data-theme-mode="dark"]) .bench-search input {
    background-color: #2e2e2e;
    border-color: #3e3e3e;
    color: #ddd;
  }
</style>
