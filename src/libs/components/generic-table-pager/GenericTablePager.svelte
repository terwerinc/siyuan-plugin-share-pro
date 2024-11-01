<!--
  -            GNU GENERAL PUBLIC LICENSE
  -               Version 3, 29 June 2007
  -
  -  Copyright (C) 2024 Terwer, Inc. <https://terwer.space/>
  -  Everyone is permitted to copy and distribute verbatim copies
  -  of this license document, but changing it is not allowed.
  -->
<svelte:options customElement="table-pager" accessors />

<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte"
  import { iconLeft, iconRight } from "./SvgIcons"
  import SvelteGenericCrudTable from "../generic-crud-table/SvelteGenericCrudTable.svelte"

  let shadowed = false
  const dispatch = createEventDispatcher()

  const pager_config_default = {
    name: "table-paginator",
    lines: 1,
    steps: [0, 1, 2, 3, 4, 5, 10, 15, 20, 30],
    width: "500px",
  }

  export let pager_data = {} as any

  function getPagerData(data) {
    if (data.length > 0) {
      data = typeof data === "string" ? JSON.parse(data) : data
      initPage()
    }
    return data
  }

  $: pager_data = getPagerData(pager_data)

  export let pager_config = pager_config_default

  function getPagerConfig(config) {
    let p_config = config === undefined ? pager_config_default : config
    p_config = typeof config === "string" ? JSON.parse(config) : config
    p_config.lines = p_config.lines === undefined ? p_config.steps[0] : p_config.lines
    p_config.steps = setSteps()

    return p_config
  }

  $: pager_config = getPagerConfig(pager_config)
  let setSteps = () => {
    let steps = pager_config.steps !== undefined ? pager_config.steps : pager_config_default.steps
    if (pager_data.length > 0) {
      steps = steps.filter((a: any) => {
        return parseInt(a) < pager_data.length
      })
      steps.push(pager_data.length)
    }
    return steps
  }

  function getSliderIndex(config) {
    let checkIndex = config.steps !== undefined ? config.steps.indexOf(config.lines) : 0
    return checkIndex
  }

  let sliderIndex = getSliderIndex(pager_config)

  let maxSteps = 1
  let currentStep = 0

  function getCurrentStep(config) {
    let conf = config.steps !== undefined ? config.steps[sliderIndex] : pager_config_default.steps[sliderIndex]
    sliderIndex = conf === undefined ? 1 : sliderIndex
    return conf === undefined ? 1 : conf
  }

  $: currentStep = getCurrentStep(pager_config)

  function getMaxSteps(config) {
    let checkMax = config.steps !== undefined ? config.steps.length - 1 : pager_config_default.steps.length - 1

    return checkMax === 0 ? config.steps.length : checkMax
  }

  $: maxSteps = getMaxSteps(pager_config)

  let currentPage = 1

  let maxPages = 1
  let max
  $: max = Math.ceil(pager_data.length / pager_config.lines)

  function getMaxPages(current_max) {
    let check_max = current_max > 0 ? current_max : 1
    return check_max === Infinity ? 1 : check_max
  }

  $: maxPages = getMaxPages(max)

  let page_data

  function getPageData(data) {
    pager_config.steps = setSteps()
    sliderIndex = sliderIndex > 1 ? sliderIndex-- : sliderIndex
    return data === undefined ? [] : data
  }

  $: page_data = getPageData(page_data)

  function initPage() {
    pager_config = typeof pager_config === "string" ? JSON.parse(pager_config) : pager_config

    if (pager_config.lines === undefined) {
      pager_config.lines = 1
    }
    page_data = pager_data.slice(pager_config.lines * (currentPage - 1), pager_config.lines * currentPage)
  }

  function getNextPage() {
    if (currentPage < maxPages) {
      page_data = pager_data.slice(pager_config.lines * currentPage, pager_config.lines * (currentPage + 1))
      currentPage++
    }
  }

  function getPreviousPage() {
    if (currentPage > 1) {
      page_data = pager_data.slice(
        pager_config.lines * currentPage - pager_config.lines * 2,
        pager_config.lines * (currentPage + 1) - pager_config.lines * 2
      )
      currentPage--
    }
  }

  function handleLeft(event) {
    if (currentPage > 1) {
      getPreviousPage()
    }
  }

  function handleRight(event) {
    getNextPage()
  }

  function handlePagerConfig(event) {
    currentPage = 1
    pager_config.steps = setSteps()
    pager_config.lines = pager_config.steps[sliderIndex]

    initPage()
  }

  function dispatcher(name, details, event) {
    dispatch(name, details)
  }

  let firstLineOfPage = 0
  $: firstLineOfPage = (() => {
    return pager_config.lines * (currentPage - 1) + 1
  }) as any

  let lastLineOfPage = 0
  $: lastLineOfPage = (() => {
    const last = pager_config.lines * (currentPage - 1) + pager_config.lines
    return last > pager_data.length ? pager_data.length : last
  }) as any

  function handleCreate(event) {
    const details = {}
    dispatcher("create", details, event)
  }

  function handleDelete(event) {
    const details = {
      id: parseInt(event.detail.id) + (currentPage - 1) * currentStep,
      body: event.detail.body,
    }
    dispatcher("delete", details, event)
  }

  function handleUpdate(event) {
    const details = {
      id: parseInt(event.detail.id) + (currentPage - 1) * currentStep,
      body: event.detail.body,
    }
    dispatcher("update", details, event)
  }

  function handleDetail(event) {
    const details = {
      id: parseInt(event.detail.id) + (currentPage - 1) * currentStep,
      body: event.detail.body,
    }
    dispatcher("details", details, event)
  }

  function handleSort(event) {
    const column = event.detail.column
    const details = {
      column: column,
    }
    dispatcher("sort", details, event)
  }

  export const table_config = {}
</script>

<div class="pager" style="width:{pager_config.width !== undefined ? pager_config.width : pager_config_default.width}">
  aaa
</div>
