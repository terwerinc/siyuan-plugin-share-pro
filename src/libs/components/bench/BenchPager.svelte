<script>
  import BenchSummary from "./BenchSummary.svelte"

  export let total, filteredTotal, limit, offset

  export let classSummary
  export let classPager = "bench-pager"
  export let classPagerCurrent = "bench-pager-current"
  export let classPagerSpread = "bench-pager-spread"

  export let textPrevious = "Previous"
  export let textNext = "Next"

  export let textShowing = "Showing"
  export let textTo = "To"
  export let textOf = "of"
  export let textEntries = "entries"
  export let textFiltered = "Filtered from"

  export let textPage = "Page"
  export let textFirstPage = "First page"

  let numPages
  let currentPage = 1
  let determinedTotal

  // initial setup of values
  const setup = () => {
    // determine total to use
    if (filteredTotal < total) {
      determinedTotal = filteredTotal
    } else {
      determinedTotal = total
    }
    // set number of pages
    numPages = Math.ceil(determinedTotal / limit)
    // determine current page
    if (offset === 0) {
      currentPage = offset + 1
    } else {
      currentPage = Math.ceil(offset / limit) + 1
    }
  }

  // change page
  const setPage = (page) => {
    if (page > 0 && page <= numPages) {
      offset = (page - 1) * limit
    }
  }

  // react to changes
  $: total, filteredTotal, limit, offset, setup()
</script>

<BenchSummary
  {total}
  {filteredTotal}
  {determinedTotal}
  {limit}
  {offset}
  {currentPage}
  {numPages}
  {classSummary}
  {textShowing}
  {textTo}
  {textOf}
  {textEntries}
  {textFiltered}
/>

<bench-pager>
  <div class={classPager}>
    <button
      tabindex="0"
      title={textPrevious}
      aria-label={textPrevious}
      class=""
      on:click={() => setPage(currentPage - 1)}>{textPrevious}</button
    >
    {#if numPages > 1 && currentPage !== 1}
      <button tabindex="0" title={textFirstPage} aria-label={textFirstPage} on:click={() => setPage(1)}>1</button>
    {/if}
    {#if currentPage - 3 >= 1}
      <button tabindex="-1" class={classPagerSpread}>...</button>
    {/if}
    {#if currentPage - 2 > 1 && !(currentPage + 3 <= numPages) && currentPage + 2 != numPages && currentPage + 1 != numPages && currentPage != numPages}
      <button
        tabindex="0"
        class=""
        title="{textPage} {currentPage - 2}"
        aria-label="{textPage} {currentPage - 2}"
        on:click={() => setPage(currentPage - 2)}>{currentPage - 2}</button
      >
    {/if}
    {#if currentPage - 1 > 1}
      <button
        tabindex="0"
        class=""
        title="{textPage} {currentPage - 1}"
        aria-label="{textPage} {currentPage - 1}"
        on:click={() => setPage(currentPage - 1)}>{currentPage - 1}</button
      >
    {/if}
    <button
      tabindex="0"
      class={classPagerCurrent}
      title="{textPage} {currentPage}"
      aria-label="{textPage} {currentPage}">{currentPage}</button
    >
    {#if currentPage + 1 < numPages}
      <button
        tabindex="0"
        class=""
        title="{textPage} {currentPage + 1}"
        aria-label="{textPage} {currentPage + 1}"
        on:click={() => setPage(currentPage + 1)}>{currentPage + 1}</button
      >
    {/if}
    {#if currentPage + 2 < numPages && !(currentPage - 3 >= 1) && currentPage - 2 != 1 && currentPage - 1 != 1 && currentPage != 1}
      <button
        tabindex="0"
        class=""
        title="{textPage} {currentPage + 2}"
        aria-label="{textPage} {currentPage + 2}"
        on:click={() => setPage(currentPage + 2)}>f{currentPage + 2}</button
      >
    {/if}
    {#if currentPage + 3 <= numPages}
      <button tabindex="-1" class={classPagerSpread}>...</button>
    {/if}
    {#if numPages > currentPage}
      <button
        tabindex="0"
        title="{textPage} {numPages}"
        aria-label="{textPage} {numPages}"
        on:click={() => setPage(numPages)}
        >{numPages}
      </button>
    {/if}
    <button tabindex="0" title={textNext} aria-label={textNext} class="" on:click={() => setPage(currentPage + 1)}>
      {textNext}
    </button>
  </div>
</bench-pager>

<style>
  bench-pager {
    grid-area: bench-pager;
  }

  .bench-pager {
    float: right;
    padding: 1em;
    white-space: nowrap;
  }

  .bench-pager button:first-child {
    border-bottom-left-radius: 6px;
    border-left: 1px solid #d2d6dc;
    border-top-left-radius: 6px;
  }

  .bench-pager button:last-child {
    border-bottom-right-radius: 6px;
    border-right: 1px solid #d2d6dc;
    border-top-right-radius: 6px;
  }

  .bench-pager button.bench-pager-current {
    background-color: #f7f7f7;
    font-weight: 700;
  }

  .bench-pager button {
    background-color: #fff;
    border: 1px solid #d2d6dc;
    border-right: none;
    cursor: pointer;
    outline: none;
    padding: 5px 14px;
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
  }

  .bench-pager button.bench-pager-spread {
    cursor: unset;
  }
</style>
