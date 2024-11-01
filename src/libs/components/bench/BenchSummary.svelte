<script>
  export let total, filteredTotal, determinedTotal, limit, offset, currentPage, numPages

  export let classSummary = "bench-summary"

  export let textShowing = "Showing"
  export let textTo = "To"
  export let textOf = "of"
  export let textEntries = "entries"
  export let textFiltered = "Filtered from"

  let shownStart = 0
  let shownEnd = 0

  // initial setup of values
  const setup = () => {
    // set summary values
    shownStart = offset
    if (offset + limit > determinedTotal) {
      shownEnd = determinedTotal
    } else {
      shownEnd = offset + limit
    }
  }

  // react to changes
  $: total, filteredTotal, determinedTotal, limit, offset, currentPage, numPages, setup()
</script>

<bench-summary>
  <div role="status" aria-live="polite" class={classSummary} title="Page {currentPage} of {numPages}">
    {textShowing} <b>{shownStart}</b>
    {textTo} <b>{shownEnd}</b>
    {textOf} <b>{determinedTotal}</b>
    {textEntries}
    {#if determinedTotal < total}({textFiltered} {total} {textEntries}){/if}
  </div>
</bench-summary>

<style>
  bench-summary {
    grid-area: bench-summary;
  }

  .bench-summary {
    padding: 1rem;
  }
</style>
