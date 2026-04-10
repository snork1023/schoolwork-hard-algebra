import { ipVersion } from "is-ip";
import { NO_HOSTNAME } from "./from-url.js";
import type { Label } from "./parse-domain.js";
export declare enum Validation {
    /**
     * Allows any octets as labels but still restricts the length of labels and
     * the overall domain.
     *
     * @see https://www.rfc-editor.org/rfc/rfc2181#section-11
     */
    Lax = "LAX",
    /**
     * Only allows ASCII letters, digits and hyphens (aka LDH), forbids hyphens at
     * the beginning or end of a label and requires top-level domain names not to
     * be all-numeric.
     *
     * This is the default if no validation is configured.
     *
     * @see https://datatracker.ietf.org/doc/html/rfc3696#section-2
     */
    Strict = "STRICT"
}
export declare enum ValidationErrorType {
    NoHostname = "NO_HOSTNAME",
    DomainMaxLength = "DOMAIN_MAX_LENGTH",
    LabelMinLength = "LABEL_MIN_LENGTH",
    LabelMaxLength = "LABEL_MAX_LENGTH",
    LabelInvalidCharacter = "LABEL_INVALID_CHARACTER",
    LastLabelInvalid = "LAST_LABEL_INVALID"
}
export type ValidationError = {
    type: ValidationErrorType;
    message: string;
    column: number;
};
export declare enum SanitizationResultType {
    ValidIp = "VALID_IP",
    ValidDomain = "VALID_DOMAIN",
    Error = "ERROR"
}
export type SanitizationResultValidIp = {
    type: SanitizationResultType.ValidIp;
    ip: string;
    ipVersion: Exclude<ReturnType<typeof ipVersion>, undefined>;
};
export type SanitizationResultValidDomain = {
    type: SanitizationResultType.ValidDomain;
    domain: string;
    labels: Array<Label>;
};
export type SanitizationResultError = {
    type: SanitizationResultType.Error;
    errors: Array<ValidationError>;
};
export type SanitizationResult = SanitizationResultValidIp | SanitizationResultValidDomain | SanitizationResultError;
export declare const sanitize: (input: string | typeof NO_HOSTNAME, options?: {
    validation?: Validation;
}) => SanitizationResult;
//# sourceMappingURL=sanitize.d.ts.map