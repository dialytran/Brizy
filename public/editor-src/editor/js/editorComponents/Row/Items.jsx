import React from "react";
import ReactDOM from "react-dom";
import _ from "underscore";
import { setIn } from "timm";
import deepMerge from "deepmerge";
import EditorArrayComponent from "visual/editorComponents/EditorArrayComponent";
import Sortable from "visual/component-new/Sortable";
import { hideToolbar } from "visual/component-new/Toolbar/index";
import { MIN_COL_WIDTH } from "visual/config/columns";
import { ContextMenuExtend } from "visual/component-new/ContextMenu";
import contextMenuExtendConfigFn from "./contextMenuExtend";
import { normalizeRowColumns } from "./utils";
import { t } from "visual/utils/i18n";

const MAX_ITEMS_IN_ROW = 6;

const toDecimalTen = number => Math.round(number * 10) / 10;

class Items extends EditorArrayComponent {
  static get componentId() {
    return "Row.Items";
  }

  static defaultProps = {
    containerClassName: "",
    meta: {},
    itemProps: {}
  };

  firstColumnIndex = null;

  firstColumnWidth = null;

  secondColumnIndex = null;

  secondColumnWidth = null;

  handleValueChange(value, meta = {}) {
    const { arrayOperation } = meta;
    const afterCloneOrRemove =
      arrayOperation === "insert" || arrayOperation === "remove";
    const newValue = afterCloneOrRemove ? normalizeRowColumns(value) : value;

    super.handleValueChange(newValue, meta);
  }

  handleColumnResize = (index, position, x) => {
    this.columnWidths = this.columnWidths || this.getResizingColumns();

    this.firstColumnIndex = index;
    this.secondColumnIndex = index + 1;

    if (position === "left") {
      this.firstColumnIndex = index - 1;
      this.secondColumnIndex = index;
    }

    let col1Width = this.columnWidths[this.firstColumnIndex] + x; // when x is negative, adding results to subtracting
    let col2Width = this.columnWidths[this.secondColumnIndex] - x; // when x is negative, subtracting results to adding because of double minus

    const sum = _.reduce(this.columnWidths, (memo, num) => memo + num, 0);

    const widthOtherColumns = _.reduce(
      _.reject(
        this.columnWidths,
        (item, key) =>
          key === this.firstColumnIndex || key == this.secondColumnIndex
      ),
      (memo, num) => memo + num,
      0
    );

    col1Width = Math.min(
      Math.max(MIN_COL_WIDTH, col1Width),
      sum - widthOtherColumns - MIN_COL_WIDTH
    );
    col2Width = Math.min(
      Math.max(MIN_COL_WIDTH, col2Width),
      sum - widthOtherColumns - MIN_COL_WIDTH
    );

    this.firstColumnWidth = toDecimalTen((col1Width * 100) / sum);
    this.secondColumnWidth = toDecimalTen((col2Width * 100) / sum);

    let newValue = setIn(
      this.getDBValue(),
      [this.firstColumnIndex, "value", "width"],
      this.firstColumnWidth
    );
    newValue = setIn(
      newValue,
      [this.secondColumnIndex, "value", "width"],
      this.secondColumnWidth
    );

    this.handleValueChange(newValue);
  };

  handleColumnResizeEnd = () => {
    this.columnWidths = null;
    this.firstColumnIndex = null;
    this.firstColumnWidth = null;
    this.secondColumnIndex = null;
    this.secondColumnWidth = null;
  };

  getItemProps(itemData, itemIndex, items) {
    const meta = deepMerge(this.props.meta, {
      row: {
        item: {
          index: itemIndex,
          isFirst: itemIndex === 0,
          isLast: itemIndex === items.length - 1,
          isOnly: items.length === 1
        }
      }
    });
    const cloneRemoveConfig = {
      getItemsForDesktop: () => [
        ...(this.canAddColumn()
          ? [
              {
                id: "emptyItem",
                type: "button",
                icon: "nc-add",
                title: t("Add New Column"),
                position: 100,
                onChange: () => {
                  this.addColumn(itemIndex + 1);
                }
              },
              {
                id: "duplicate",
                type: "button",
                icon: "nc-duplicate",
                title: t("Duplicate"),
                position: 200,
                onChange: () => {
                  this.cloneItem(itemIndex);
                }
              }
            ]
          : []),
        {
          id: "remove",
          type: "button",
          title: t("Delete"),
          icon: "nc-trash",
          position: 250,
          onChange: () => {
            hideToolbar();
            this.removeItem(itemIndex);
          }
        }
      ],
      getItemsForTablet: () => [],
      getItemsForMobile: () => []
    };
    const toolbarExtend = this.makeToolbarPropsFromConfig(cloneRemoveConfig);

    return {
      ...this.props.itemProps,
      meta,
      toolbarExtend,
      popoverData: this.getPopoverData,
      onResize: (position, x) =>
        this.handleColumnResize(itemIndex, position, x),
      onResizeEnd: this.handleColumnResizeEnd
    };
  }

  handleSortableAcceptElements = (from, to) => {
    if (from.elementType === "addable") {
      const addableSubtype = from.elementNode.getAttribute(
        "data-sortable-subtype"
      );

      if (addableSubtype === "row") {
        return false;
      }
    }

    const sameNode = from.sortableNode === to.sortableNode;
    const acceptsElement =
      ["column", "shortcode", "addable"].indexOf(from.elementType) !== -1;
    const hasEnoughSpace = to.sortableNode.children.length < MAX_ITEMS_IN_ROW;

    return sameNode || (acceptsElement && hasEnoughSpace);
  };

  getResizingColumns = () => {
    const node = ReactDOM.findDOMNode(this);

    return _.map(node.children, elem => elem.getBoundingClientRect().width);
  };

  getPopoverData = () => {
    const firstColumnWidth =
      this.firstColumnWidth === null ? "0" : this.firstColumnWidth.toFixed(1);
    const secondColumnWidth =
      this.secondColumnWidth === null ? "0" : this.secondColumnWidth.toFixed(1);

    return [firstColumnWidth, secondColumnWidth];
  };

  canAddColumn() {
    const v = this.getValue();

    return v.length < MAX_ITEMS_IN_ROW;
  }

  addColumn(index) {
    const v = this.getValue();
    const itemData = {
      ...v[0],
      value: {
        items: []
      }
    };

    this.insertItem(index, itemData);
  }

  renderItemWrapper(item, itemKey, itemIndex) {
    const contextMenuExtendConfig = contextMenuExtendConfigFn(itemIndex);

    return (
      <ContextMenuExtend
        key={itemKey}
        {...this.makeContextMenuProps(contextMenuExtendConfig)}
      >
        {item}
      </ContextMenuExtend>
    );
  }

  renderItemsContainer(items) {
    if (IS_PREVIEW) {
      return <div className={this.props.containerClassName}>{items}</div>;
    }

    const sortableContent = items.length ? (
      <div className={this.props.containerClassName}>{items}</div>
    ) : null;

    return (
      <Sortable
        path={this.getPath()}
        type="row"
        isGrid={true}
        acceptElements={this.handleSortableAcceptElements}
      >
        {sortableContent}
      </Sortable>
    );
  }
}

export default Items;
