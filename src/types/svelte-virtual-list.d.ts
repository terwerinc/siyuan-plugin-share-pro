/*
 *            GNU GENERAL PUBLIC LICENSE
 *               Version 3, 29 June 2007
 *
 *  Copyright (C) 2025 Terwer, Inc. <https://terwer.space/>
 *  Everyone is permitted to copy and distribute verbatim copies
 *  of this license document, but changing it is not allowed.
 */

declare module "@sveltejs/svelte-virtual-list" {
  import { SvelteComponent } from "svelte";

  interface VirtualListProps {
    items: any[];
    height?: string | number;
    itemHeight?: number;
    start?: number;
    end?: number;
  }

  export default class VirtualList extends SvelteComponent<VirtualListProps> {
    $$slots: {
      default: {
        item: any;
      };
    };
  }
}