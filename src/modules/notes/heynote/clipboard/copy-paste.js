import { EditorSelection } from "@codemirror/state"
import { EditorView } from "@codemirror/view"

import { serializeToText, serializeToHeynote, serializeToHtml, unserializeFromHeynote } from "./serialize.js"


function copiedRange(state) {
    let content = [], ranges = []
    for (let range of state.selection.ranges) {
        if (!range.empty) {
            content.push(state.sliceDoc(range.from, range.to))
            ranges.push(range)
        }
    }
    if (ranges.length == 0) {
        const copiedLines = []
        for (let range of state.selection.ranges) {
            if (range.empty) {
                const line = state.doc.lineAt(range.head)
                const lineContent = state.sliceDoc(line.from, line.to)
                if (!copiedLines.includes(line.from)) {
                    content.push(lineContent)
                    ranges.push(range)
                    copiedLines.push(line.from)
                }
            }
        }
    }
    return { text: content.join(state.lineBreak), ranges }
}

export const heynoteCopyCut = (editor) => {
    let copy, cut
    copy = cut = async (event, view) => {
        event.preventDefault()
        await copyCut(editor.view, event.type == "cut", editor)
    }
    return EditorView.domEventHandlers({ copy, cut })
}

const toBlob = (text, type) => new Blob([text], {type:type})

const copyCut = async (view, cut, editor) => {
    let { text, ranges } = copiedRange(view.state)
    const formats = {
        "text/plain": toBlob(serializeToText(text), "text/plain"),
        "text/html": toBlob(await serializeToHtml(text), "text/html"),
    }
    if (ClipboardItem.supports("web text/heynote")) {
        formats["web text/heynote"] = toBlob(serializeToHeynote(text), "web text/heynote")
    }
    await navigator.clipboard.write([new ClipboardItem(formats)])

    if (cut && !view.state.readOnly) {
        view.dispatch({
            changes: ranges,
            scrollIntoView: true,
            userEvent: "delete.cut"
        })
    }

    editor.selectionMarkMode = false

    if (editor.deselectOnCopy && !cut) {
        const newSelection = EditorSelection.create(
            view.state.selection.ranges.map(r => EditorSelection.cursor(r.head)),
            view.state.selection.mainIndex,
        )
        view.dispatch(view.state.update({ selection: newSelection }))
    }
    return true
}

function doPaste(view, input) {
    let { state } = view, changes, i = 1, text = state.toText(input)
    let byLine = text.lines == state.selection.ranges.length
    if (byLine) {
        changes = state.changeByRange(range => {
            let line = text.line(i++)
            return {
                changes: { from: range.from, to: range.to, insert: line.text },
                range: EditorSelection.cursor(range.from + line.length)
            }
        })
    } else {
        changes = state.replaceSelection(text)
    }
    view.dispatch(changes, { userEvent: "input.paste", scrollIntoView: true })
}

export function copyCommand(editor) {
    return (view) => copyCut(view, false, editor)
}

export function cutCommand(editor) {
    return (view) => copyCut(view, true, editor)
}

export async function pasteAsTextCommand(view) {
    return doPaste(view, await navigator.clipboard.readText())
}

export async function pasteCommand(view) {
    const items = await navigator.clipboard.read()
    for (const item of items) {
        if (item.types.includes("web text/heynote")) {
            const blob = await item.getType("web text/heynote")
            doPaste(view, unserializeFromHeynote(await blob.text()))
            return
        }
    }
    return doPaste(view, await navigator.clipboard.readText())
}
