import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["coverage/", "out/", "node_modules/"],
    },
    ...tseslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/no-require-imports": 0,
            "@typescript-eslint/no-explicit-any": 0,
        },
    },
);