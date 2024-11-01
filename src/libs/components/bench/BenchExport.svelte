<script>
    export let columns, onExport;
    export let classExport = "bench-export";

    const csvTable = async (e) => {
        const exportData = await onExport('csv');
        if (exportData) {
            let csv = [];
            let header = [];
            Object.values(columns).forEach((col) => {
                if (col.hidden === true) {
                    return;
                }
                header.push(col.name);
            });
            csv.push(header.join(',') + "\r\n");
            Object.values(exportData.results).forEach((data) => {
                let row = [];
                Object.values(columns).forEach((col) => {
                    if (col.hidden === true) {
                        return;
                    }
                    let item = String(data[col.id]);
                    item = item.replace(/(\r\n|\n|\r|\s+|\t|&nbsp;)/gm,' ');
                    item = item.replace(/"/g, '""');
                    item = item.replace(/ +(?= )/g,'');
                    row.push('"' + item + '"');
                });
                csv.push(row.join(',') + "\r\n")
            });
            const blob = new Blob(csv, {type: "text/csv"});
            const url = URL.createObjectURL(blob);
            let hiddenElement = document.createElement('a');
            hiddenElement.setAttribute('href', url);
            hiddenElement.setAttribute('target', '_blank');
            hiddenElement.setAttribute('download', 'File.csv');
            hiddenElement.click();
            hiddenElement.remove();
        }
    }

</script>

{#if onExport}
<bench-export>
    <div class={classExport}>
        <button on:click={(e) => csvTable(e)}>CSV</button>
    </div>
</bench-export>
{/if}

<style>
    bench-export {
        grid-area: bench-export;
    }

    .bench-export {
        text-align: right;
    }

    .bench-export button {
        border-radius: 6px;
        border: 1px solid #d2d6dc;
        white-space: nowrap;
        background-color: #fff;
        padding: 5px 14px;
        cursor: pointer;
    }
</style>
