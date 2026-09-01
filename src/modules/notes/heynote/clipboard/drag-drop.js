import { EditorView } from "@codemirror/view"

export const heynoteDropPaste = () => { // [DEVTool] 仅文本
    const handleDrop = (event, view) => {
        const text = event.dataTransfer?.getData("text/plain")
        if (!text || view.state.readOnly) return false
        event.preventDefault()
        event.stopPropagation()
        view.focus()
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
            ?? view.state.selection.main.head
        view.dispatch(view.state.replaceSelection(text))
        return true
    }
    const handleDragOver = (event) => {
        if (!event.dataTransfer?.getData("text/plain")) return false
        event.preventDefault()
        return true
    }
    return EditorView.domEventHandlers({ dragover: handleDragOver, drop: handleDrop })
}
