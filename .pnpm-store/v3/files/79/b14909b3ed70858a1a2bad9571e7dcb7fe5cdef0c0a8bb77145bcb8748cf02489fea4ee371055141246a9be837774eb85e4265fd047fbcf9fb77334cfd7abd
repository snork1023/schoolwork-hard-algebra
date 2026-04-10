import { DOWN, SAME, UP } from "./characters.js";
export const serializeTrie = (root) => {
    let serialized = "";
    const queue = [...root.children.values()];
    let current;
    while ((current = queue.shift()) !== undefined) {
        if (current === UP) {
            serialized += UP;
            continue;
        }
        serialized += current.label;
        if (current.children.size === 0) {
            if (queue.length > 0 && queue[0] !== UP) {
                serialized += SAME;
            }
            continue;
        }
        serialized += DOWN;
        const newItems = [...current.children.values()];
        if (queue.length > 0) {
            newItems.push(UP);
        }
        queue.unshift(...newItems);
    }
    return serialized;
};
//# sourceMappingURL=serialize-trie.js.map