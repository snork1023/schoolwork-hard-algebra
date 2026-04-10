import { createOrGetChild, createRootNode } from "./nodes.js";
export const createTrieFromList = (list) => {
    const root = createRootNode();
    for (const rule of list) {
        let node = root;
        // We do not want to break compatibility with older engines unnecessarily.
        // eslint-disable-next-line unicorn/no-array-reverse
        for (const label of rule.split(".").reverse()) {
            node = createOrGetChild(node, label);
        }
    }
    return root;
};
//# sourceMappingURL=create-trie.js.map