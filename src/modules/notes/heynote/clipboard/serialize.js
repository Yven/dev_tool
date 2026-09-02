import { BLOCK_DELIMITER_REGEX } from "../block/block-parsing"

export function serializeToText(text) {
    return text.replaceAll(BLOCK_DELIMITER_REGEX, "\n\n")
}

export async function serializeToHtml(text) {
    return text.replaceAll(BLOCK_DELIMITER_REGEX, "\n\n").replaceAll("\n", "<br>")
}

export function serializeToHeynote(text) {
    return text
}

export function unserializeFromHeynote(text) {
    return text
}
