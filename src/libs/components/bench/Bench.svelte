<script lang="ts">
  import BenchPager from "./BenchPager.svelte"
  import BenchSearch from "./BenchSearch.svelte"
  import BenchTable from "./BenchTable.svelte"
  import BenchExport from "./BenchExport.svelte"

  export let data: any = []
  export let columns = []
  export let limit,
    offset,
    order,
    dir,
    search = undefined

  export let onExport = undefined

  export let classBenchContainer = "bench-container"
  export let classTableWrapper = undefined
  export let classTable = undefined
  export let classTableBody = undefined
  export let classTableHead = undefined
  export let classTableData = undefined
  export let classTableHeader = undefined
  export let classTableRow = undefined
  export let classSearch = undefined
  export let classPager = undefined
  export let classSummary = undefined
  export let classPagerCurrent = undefined
  export let classPagerSpread = undefined
  export let classExport = undefined
  export let searchPlaceholder = undefined
  export let textPrevious = undefined
  export let textNext = undefined
  export let textShowing = undefined
  export let textTo = undefined
  export let textOf = undefined
  export let textEntries = undefined
  export let textFiltered = undefined
  export let textPage = undefined
  export let textFirstPage = undefined

  // reset offset on search
  const resetOffset = () => {
    offset = 0
  }
  $: search, resetOffset()
</script>

<div class={classBenchContainer}>
  <BenchSearch bind:searchTerm={search} {classSearch} {searchPlaceholder} />

  <BenchTable
    {data}
    {columns}
    bind:order
    bind:dir
    {classTableWrapper}
    {classTable}
    {classTableBody}
    {classTableHead}
    {classTableData}
    {classTableHeader}
    {classTableRow}
  />

  <BenchPager
    bind:limit
    bind:offset
    total={data.recordsTotal}
    filteredTotal={data.recordsFiltered}
    {classPager}
    {classSummary}
    {classPagerCurrent}
    {classPagerSpread}
    {textPrevious}
    {textNext}
    {textShowing}
    {textTo}
    {textOf}
    {textEntries}
    {textFiltered}
    {textPage}
    {textFirstPage}
  />

  <BenchExport {onExport} {columns} {classExport} />
</div>

<style>
  .bench-container {
    display: grid;
    width: 100%;
    grid-template-areas:
      "bench-search bench-export"
      "bench-table  bench-table"
      "bench-summary  bench-pager";
    grid-template-rows: 3em 1fr 3em;
    grid-template-columns: 50% 50%;
  }
</style>
