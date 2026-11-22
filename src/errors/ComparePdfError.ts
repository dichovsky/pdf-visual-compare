/**
 * Base error for all public exceptions that `comparePdf` throws.
 */
export class ComparePdfError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = new.target.name;
    }
}
