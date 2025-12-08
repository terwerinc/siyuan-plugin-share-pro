<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->

<script>
    export let data, columns, order, dir

    export let classTableWrapper = "bench-wrapper"
    export let classTable = "bench-table"
    export let classTableBody = "bench-tbody"
    export let classTableHead = "bench-thead"
    export let classTableData = "bench-td"
    export let classTableHeader = "bench-th"
    export let classTableRow = "bench-tr"

    const sort = (col) => {
        if (col.sort !== false) {
            if (col.id == order) {
                if (!dir) {
                    dir = "desc"
                } else {
                    dir = dir == "desc" ? "asc" : "desc"
                }
            } else {
                order = col.id
                dir = "desc"
            }
        }
    }
</script>

<bench-table>
    {#if data.results}
        <div class={classTableWrapper}>
            <table class={classTable}>
                <thead class={classTableHead}>
                <tr class={classTableRow}>
                    {#each columns as col}
                        <th
                                class="{classTableHeader} {col.sort !== false ? 'sort' : ''} {col.id == order ? 'sorted' : ''}"
                                style={col.hidden === true ? "display: none" : ""}
                                on:click={() => sort(col)}
                        >
                            {col.name ?? ""}
                            {#if col.sort !== false}
                  <span class="sortIcon">
                    {#if col.id == order}
                      <button class={dir == "desc" ? "sort-desc" : "sort-asc"}/>
                    {:else}
                      <button class="unsorted"/>
                    {/if}
                  </span>
                            {/if}
                        </th>
                    {/each}
                </tr>
                </thead>
                <tbody class={classTableBody}>
                {#each data.results as row}
                    <tr class={classTableRow}>
                        {#each columns as col}
                            <td
                                    class={classTableData}
                                    style={col.hidden === true ? "display: none" : ""}
                                    on:click={(e) => (col.onClick ? col.onClick(e) : undefined)}
                                    on:keydown={(e) => (col.onKeyDown ? col.onKeyDown(e) : undefined)}
                                    on:change={(e) => (col.onChange ? col.onChange(e) : undefined)}
                                    on:mouseover={(e) => (col.onMouseOver ? col.onMouseOver(e) : undefined)}
                                    on:focus={(e) => (col.onFocus ? col.onFocus(e) : undefined)}
                                    on:mouseout={(e) => (col.onMouseOut ? col.onMouseOut(e) : undefined)}
                                    on:blur={(e) => (col.onBlur ? col.onBlur(e) : undefined)}
                                    on:keydown={(e) => (col.onKeyDown ? col.onKeyDown(e) : undefined)}
                            >
                                {#if col.formatter}
                                    {#if col.html}
                                        {@html col.formatter(row[col.id]) ?? ""}
                                    {:else}
                                        {col.formatter(row[col.id]) ?? ""}
                                    {/if}
                                {:else if col.html}
                                    {@html row[col.id] ?? ""}
                                {:else}
                                    {row[col.id] ?? ""}
                                {/if}
                            </td>
                        {/each}
                    </tr>
                {/each}
                </tbody>
            </table>
        </div>
    {/if}
</bench-table>

<style>
    bench-table {
        margin-top: 10px;
        grid-area: bench-table;
    }

    .bench-wrapper {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        border-color: #e5e7eb;
        border-radius: 8px 8px 0 0;
        border-top-width: 1px;
        box-shadow: 0 1px 3px #0000001a, 0 1px 2px #00000042;
        display: block;
        overflow: auto;
        position: relative;
        width: 100%;
        z-index: 1;
    }

    table.bench-table {
        border-collapse: collapse;
        display: table;
        margin: 0;
        max-width: 100%;
        overflow: auto;
        padding: 0;
        table-layout: auto;
        text-align: left;
        width: 100%;
    }

    td.bench-td:first-child {
        border-left: none;
    }

    td.bench-td:last-child {
        border-right: none;
    }

    td.bench-td {
        border: 1px solid #e5e7eb;
        box-sizing: content-box;
        padding: 0.5rem 0.5rem;
        overflow: auto;
    }

    .bench-tbody,
    td.bench-td {
        background-color: #fff;
    }

    th.bench-th {
        background-color: #f9fafb;
        border: 1px solid #e5e7eb;
        border-top: none;
        box-sizing: border-box;
        color: #6b7280;
        outline: none;
        padding: 0.2rem 0.5rem;
        position: relative;
        -webkit-user-select: none;
        -moz-user-select: none;
        user-select: none;
        vertical-align: middle;
        white-space: nowrap;
        font-weight: normal;
    }

    th.sort {
        cursor: pointer;
    }

    th.sorted {
        font-weight: bold;
    }

    th.bench-th span.sortIcon button {
        border: none;
        cursor: pointer;
        float: right;
        height: 24px;
        margin: 0;
        outline: none;
        padding: 0;
        width: 15px;
    }

    th.bench-th span.sortIcon button.unsorted {
        mask: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDEuOTk4IiBoZWlnaHQ9IjQwMS45OTgiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDQwMS45OTggNDAxLjk5OCIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PHBhdGggZD0iTTczLjA5MiAxNjQuNDUyaDI1NS44MTNjNC45NDkgMCA5LjIzMy0xLjgwNyAxMi44NDgtNS40MjQgMy42MTMtMy42MTYgNS40MjctNy44OTggNS40MjctMTIuODQ3cy0xLjgxMy05LjIyOS01LjQyNy0xMi44NUwyMTMuODQ2IDUuNDI0QzIxMC4yMzIgMS44MTIgMjA1Ljk1MSAwIDIwMC45OTkgMHMtOS4yMzMgMS44MTItMTIuODUgNS40MjRMNjAuMjQyIDEzMy4zMzFjLTMuNjE3IDMuNjE3LTUuNDI0IDcuOTAxLTUuNDI0IDEyLjg1IDAgNC45NDggMS44MDcgOS4yMzEgNS40MjQgMTIuODQ3IDMuNjIxIDMuNjE3IDcuOTAyIDUuNDI0IDEyLjg1IDUuNDI0ek0zMjguOTA1IDIzNy41NDlINzMuMDkyYy00Ljk1MiAwLTkuMjMzIDEuODA4LTEyLjg1IDUuNDIxLTMuNjE3IDMuNjE3LTUuNDI0IDcuODk4LTUuNDI0IDEyLjg0N3MxLjgwNyA5LjIzMyA1LjQyNCAxMi44NDhMMTg4LjE0OSAzOTYuNTdjMy42MjEgMy42MTcgNy45MDIgNS40MjggMTIuODUgNS40MjhzOS4yMzMtMS44MTEgMTIuODQ3LTUuNDI4bDEyNy45MDctMTI3LjkwNmMzLjYxMy0zLjYxNCA1LjQyNy03Ljg5OCA1LjQyNy0xMi44NDggMC00Ljk0OC0xLjgxMy05LjIyOS01LjQyNy0xMi44NDctMy42MTQtMy42MTYtNy44OTktNS40Mi0xMi44NDgtNS40MnoiLz48L3N2Zz4=);
        mask-size: contain;
        mask-position: center;
        mask-repeat: no-repeat;
        background-color: #6b7280;
    }

    th.bench-th span.sortIcon button.sort-asc {
        mask: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOTIuMzYyIiBoZWlnaHQ9IjI5Mi4zNjEiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDI5Mi4zNjIgMjkyLjM2MSIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PHBhdGggZD0iTTI4Ni45MzUgMTk3LjI4NyAxNTkuMDI4IDY5LjM4MWMtMy42MTMtMy42MTctNy44OTUtNS40MjQtMTIuODQ3LTUuNDI0cy05LjIzMyAxLjgwNy0xMi44NSA1LjQyNEw1LjQyNCAxOTcuMjg3QzEuODA3IDIwMC45MDQgMCAyMDUuMTg2IDAgMjEwLjEzNHMxLjgwNyA5LjIzMyA1LjQyNCAxMi44NDdjMy42MjEgMy42MTcgNy45MDIgNS40MjUgMTIuODUgNS40MjVoMjU1LjgxM2M0Ljk0OSAwIDkuMjMzLTEuODA4IDEyLjg0OC01LjQyNSAzLjYxMy0zLjYxMyA1LjQyNy03Ljg5OCA1LjQyNy0xMi44NDdzLTEuODE0LTkuMjMtNS40MjctMTIuODQ3eiIvPjwvc3ZnPg==);
        mask-size: contain;
        mask-position: center;
        mask-repeat: no-repeat;
        background-color: #6b7280;
        mask-position: top;
        margin-top: 2px;
        width: 10px;
    }

    th.bench-th span.sortIcon button.sort-desc {
        mask: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyOTIuMzYyIiBoZWlnaHQ9IjI5Mi4zNjIiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDI5Mi4zNjIgMjkyLjM2MiIgeG1sOnNwYWNlPSJwcmVzZXJ2ZSI+PHBhdGggZD0iTTI4Ni45MzUgNjkuMzc3Yy0zLjYxNC0zLjYxNy03Ljg5OC01LjQyNC0xMi44NDgtNS40MjRIMTguMjc0Yy00Ljk1MiAwLTkuMjMzIDEuODA3LTEyLjg1IDUuNDI0QzEuODA3IDcyLjk5OCAwIDc3LjI3OSAwIDgyLjIyOGMwIDQuOTQ4IDEuODA3IDkuMjI5IDUuNDI0IDEyLjg0N2wxMjcuOTA3IDEyNy45MDdjMy42MjEgMy42MTcgNy45MDIgNS40MjggMTIuODUgNS40MjhzOS4yMzMtMS44MTEgMTIuODQ3LTUuNDI4TDI4Ni45MzUgOTUuMDc0YzMuNjEzLTMuNjE3IDUuNDI3LTcuODk4IDUuNDI3LTEyLjg0NyAwLTQuOTQ4LTEuODE0LTkuMjI5LTUuNDI3LTEyLjg1eiIvPjwvc3ZnPg==);
        mask-size: contain;
        mask-position: center;
        mask-repeat: no-repeat;
        background-color: #6b7280;
        mask-position: bottom;
        margin-bottom: 2px;
        width: 10px;
    }

    /* 适配暗黑模式 */
    :global(html[data-theme-mode="dark"]) .bench-wrapper {
        background-color: #1f2937;
        border-color: #374151;
        box-shadow: 0 1px 3px #0000001a, 0 1px 2px #00000042;
    }

    :global(html[data-theme-mode="dark"]) th.bench-th {
        background-color: var(--b3-theme-background);
        border-color: #374151;
        color: #9ca3af;
    }

    :global(html[data-theme-mode="dark"]) td.bench-td {
        background-color: var(--b3-theme-surface);
        border-color: #374151;
    }
</style>
