import type { ColumnConfig, ColumnOption, FilterItem } from "./types";

type BuilderState<TData, TValue, TType extends FilterItem["type"]> = {
  accessor?: (row: TData) => TValue;
  displayName?: string;
  hidden?: boolean;
  id?: string;
  options?: readonly ColumnOption[];
  type: TType;
};

class ColumnConfigBuilder<TData, TValue, TType extends FilterItem["type"]> {
  constructor(private readonly state: BuilderState<TData, TValue, TType>) {}

  accessor<TNextValue>(accessor: (row: TData) => TNextValue) {
    return new ColumnConfigBuilder<TData, TNextValue, TType>({ ...this.state, accessor });
  }

  displayName(displayName: string) {
    return new ColumnConfigBuilder({ ...this.state, displayName });
  }

  hidden() {
    return new ColumnConfigBuilder({ ...this.state, hidden: true });
  }

  id(id: string) {
    return new ColumnConfigBuilder({ ...this.state, id });
  }

  options(options: readonly ColumnOption[]) {
    return new ColumnConfigBuilder({ ...this.state, options });
  }

  build(): ColumnConfig<TData, TValue, TType> {
    if (!this.state.id || !this.state.displayName || !this.state.accessor) {
      throw new Error("Column filter config requires id, displayName, and accessor.");
    }

    return {
      accessor: this.state.accessor,
      displayName: this.state.displayName,
      hidden: this.state.hidden,
      id: this.state.id,
      options: this.state.options,
      type: this.state.type,
    };
  }
}

export type FluentColumnConfigHelper<TData> = ReturnType<typeof createColumnConfigHelper<TData>>;

export function createColumnConfigHelper<TData>() {
  return {
    date: () => new ColumnConfigBuilder<TData, unknown, "date">({ type: "date" }),
    multiOption: () =>
      new ColumnConfigBuilder<TData, unknown, "multiOption">({ type: "multiOption" }),
    number: () => new ColumnConfigBuilder<TData, unknown, "number">({ type: "number" }),
    option: () => new ColumnConfigBuilder<TData, unknown, "option">({ type: "option" }),
    text: () => new ColumnConfigBuilder<TData, unknown, "text">({ type: "text" }),
  };
}
