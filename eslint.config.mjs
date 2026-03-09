import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["coverage/", "out/", "node_modules/"],
    },
    ...tseslint.configs.recommended,
);
