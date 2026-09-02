import { formatFullDateWithoutSeconds } from "./common/format-date"


export const insertDateAndTime = ({ state, dispatch }) => {
    if (state.readOnly) {
        return false
    }

    const dateText = formatFullDateWithoutSeconds(new Date(), navigator.language)

    dispatch(state.replaceSelection(dateText),
        {
            scrollIntoView: true,
            userEvent: "input",
        }
    )
    return true;
}
