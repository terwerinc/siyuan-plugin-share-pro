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