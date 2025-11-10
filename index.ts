export {};

// Types

interface CostEntry {
  cost: number;
  count: number;
}

interface CostChild {
  [x: string]: CostEntry;
}

interface CostData {
  init: CostChild;
  late: CostChild;
}

interface TreeNode {
  cost: number;
  count: number;
  direct_cost: number;
  direct_count: number;
  children: any;
  path: string;
  is_leaf: boolean;
}

interface Tree {
  [x: string]: TreeNode;
}

declare global {
  interface Window {
    DATA: CostData | null;
    iLoveNumbersIShouldMarryThem: boolean;
    setMode: (m: "init" | "late") => void;
    setSort: (s: "total" | "avg") => void;
    renderAll: () => void;
  }
}


// Globals

window.DATA = null as CostData | null; // to be filled by external script
window.iLoveNumbersIShouldMarryThem = false;
window.setMode = setMode;
window.setSort = setSort;
window.renderAll = renderAll;
let MODE: "init" | "late" = "init"; // 'init' or 'late'
let SORT: "total" | "avg" = "total"; // 'total' or 'avg'
let TIME_UNIT = "ds"; // "ds" (default) or "ms"

function convertTime(ds: number) {
  switch (TIME_UNIT) {
    case "ms": // deciseconds → milliseconds
      return ds * 100;
    case "s": // deciseconds → seconds
      return ds / 10;
    case "µs": // deciseconds → microseconds
      return ds * 100000;
    default:
      return ds; // ds
  }
}

function buildTree(flat: CostChild): Tree {
  const root = {} as Tree;
  for (const path in flat) {
    const entry = flat[path];
    const parts = path.split("/").filter(Boolean);
    let node = root;
    let built = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      built += (built ? "/" : "") + part;
      if (!node[part]) {
        node[part] = {
          cost: 0,
          count: 0,
          direct_cost: 0,
          direct_count: 0,
          children: {},
          path: built,
          is_leaf: i === parts.length - 1,
        };
      }
      if (i === parts.length - 1) {
        node[part].direct_cost = entry.cost || 0;
        node[part].direct_count = entry.count || 0;
      }
      node[part].cost += entry.cost || 0;
      node[part].count += entry.count || 0;
      node = node[part].children;
    }
  }
  return root;
}

function formatNumber(n: number, decimals = 3): number {
  if (window.iLoveNumbersIShouldMarryThem) {
    return n;
  } else {
    // return Math.round(n * 1000) / 1000;
    return Number.parseInt(n.toFixed(decimals));
  }
}
function clearChildren(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function sortedKeys(tree: Tree, sortByAvg: boolean, totalCost: number) {
  const keys = Object.keys(tree);
  keys.sort((a, b) => {
    const n1 = tree[a],
      n2 = tree[b];
    const v1 = sortByAvg ? n1.cost / Math.max(n1.count, 1) : n1.cost;
    const v2 = sortByAvg ? n2.cost / Math.max(n2.count, 1) : n2.cost;
    return v2 - v1; // descending
  });
  return keys;
}

let idCounter = 0;
/**
 * @param {{ [x: string]: any; }} tree
 * @param {HTMLElement | null} container
 * @param {number} totalCost
 * @param {boolean} sortByAvg
 */
function renderTree(tree: Tree, container: HTMLElement, totalCost: number, sortByAvg: boolean) {
  const keys = sortedKeys(tree, sortByAvg, totalCost);
  for (const key of keys) {
    const node = tree[key];
    const rawCost = node.cost;
    const cost = convertTime(rawCost);
    const count = node.count;
    const rawAvg = rawCost / Math.max(count, 1);
    const direct_cost = node.direct_cost;
    const direct_count = node.direct_count;
    const avg_cost = formatNumber(convertTime(rawAvg));
    // const avg_cost = formatNumber(cost / Math.max(count, 1));
    const percentage = totalCost > 0 ? formatNumber((cost / totalCost) * 100) : 0;
    idCounter++;
    const myId = "node" + idCounter;
    const hasChildren = Object.keys(node.children).length > 0;
    let costClass = "cost-low";
    if (percentage >= 10) costClass = "cost-high";
    else if (percentage >= 1) costClass = "cost-med";

    const item = document.createElement("div");
    item.className = "tree-item";

    const exp = document.createElement("span");
    exp.className = "expander";
    exp.id = "exp_" + myId;
    exp.textContent = hasChildren ? "▼" : "\u00A0";
    if (hasChildren) exp.style.cursor = "pointer";
    item.appendChild(exp);

    const nameSpan = document.createElement("span");
    nameSpan.className = costClass;
    nameSpan.textContent = key;
    item.appendChild(nameSpan);

    const info = document.createElement("span");
    info.innerHTML =
      " - <b>" +
      cost +
      TIME_UNIT +
      '</b> <span class="count">(' +
      count +
      'x)</span> <span class="avg">' +
      avg_cost +
      TIME_UNIT +
      " avg</span>";
    if (direct_cost > 0 && hasChildren) {
      const directCostConv = convertTime(direct_cost);
      const directAvgConv = formatNumber(convertTime(direct_cost / Math.max(direct_count, 1)));
      info.innerHTML +=
        " (direct: " + directCostConv + TIME_UNIT + ", " + direct_count + "x, " + directAvgConv + TIME_UNIT + " avg) ";
    }

    info.innerHTML += ' <span class="percentage">(' + percentage + "%)</span>";
    item.appendChild(info);

    container.appendChild(item);

    if (hasChildren) {
      const childContainer = document.createElement("div");
      childContainer.className = "tree-node";
      childContainer.id = myId;
      container.appendChild(childContainer);
      // by default children are visible; toggle handler
      item.style.cursor = "pointer";
      item.addEventListener("click", (e) => {
        if (e.target !== item && e.target !== nameSpan && e.target !== exp) return;

        if (childContainer.style.display === "none") {
          childContainer.style.display = "block";
          exp.textContent = "▼";
        } else {
          childContainer.style.display = "none";
          exp.textContent = "▶";
        }
      });
      renderTree(node.children, childContainer, totalCost, sortByAvg);
    }
  }
}

function renderAll() {
  if (!window.DATA) return;
  const flat = MODE === "init" ? window.DATA.init : window.DATA.late;
  const tree = buildTree(flat);
  // compute totals
  let totalCost = 0,
    totalCount = 0,
    types = 0;
  for (const k in flat) {
    totalCost += flat[k].cost || 0;
    totalCount += flat[k].count || 0;
    types++;
  }

  const summary = document.getElementById("summary")!;
  const convertedTotal = convertTime(totalCost);
  summary.innerHTML =
    "<h2>" +
    (MODE === "late" ? "Late " : "") +
    "Initialization Cost Analysis</h2>" +
    "<b>Total " +
    (MODE === "late" ? "Late " : "") +
    "Init Time:</b> " +
    convertedTotal +
    " " +
    TIME_UNIT +
    " (" +
    formatNumber(totalCost / 10) +
    "s)<br>" +
    "<b>Total Instances:</b> " +
    totalCount +
    "<br>" +
    "<b>Total Types:</b> " +
    types +
    "<br>" +
    "<b>Average Cost:</b> " +
    formatNumber(convertTime(totalCost / Math.max(totalCount, 1)), 6) +
    " " +
    TIME_UNIT +
    " per instance<br>" +
    "<b>Sorting by:</b> " +
    (SORT === "avg" ? "Average time per instance" : "Total time");

  const root = document.getElementById("tree_root")!;
  clearChildren(root);
  idCounter = 0;
  renderTree(tree, root, totalCost, SORT === "avg");
  // update buttons classes
  document.getElementById("btn_init")!.className = MODE === "init" ? "active" : "";
  document.getElementById("btn_late")!.className = MODE === "late" ? "active" : "";
  document.getElementById("btn_total")!.className = SORT === "total" ? "active" : "";
  document.getElementById("btn_avg")!.className = SORT === "avg" ? "active" : "";

  document.getElementById("mainContent")!.style.display = "block";
}

(document.getElementById("timeUnitSelect") as HTMLInputElement).addEventListener("change", function () {
  TIME_UNIT = this.value;
  renderAll();
});

function setMode(m: typeof MODE) {
  if (MODE === m) return;
  MODE = m;
  renderAll();
}

function setSort(s: typeof SORT) {
  if (SORT === s) return;
  SORT = s;
  renderAll();
}

