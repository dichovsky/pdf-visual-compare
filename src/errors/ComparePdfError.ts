/**
 * Base error for all public library exceptions thrown by `comparePdf`.
 */
export class ComparePdfError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = new.target.name;
    }
}
