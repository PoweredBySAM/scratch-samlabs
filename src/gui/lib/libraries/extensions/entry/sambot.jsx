/**
 * This is an extension for Xcratch.
 */

import iconURL from './sambot.png';
import insetIconURL from './samlabs-small.svg';
import translations from './translations.json';

/**
 * Formatter to translate the messages in this extension.
 * This will be replaced which is used in the React component.
 * @param {object} messageData - data for format-message
 * @returns {string} - translated message for the current locale
 */
let formatMessage = messageData => messageData.defaultMessage;

const entry = {
    get name () {
        return formatMessage({
            id: 'sambot.entry.name',
            defaultMessage: 'Baby SAM Bot',
            description: 'Name for the \'Baby SAM Bot\' extension'
        });
    },
    extensionId: 'sambot',
    extensionURL: 'https://Rbel12b.github.io/Scratch/dist/sambot.mjs',
    // collaborator: 'Rbel12b',
    iconURL: iconURL,
    insetIconURL: insetIconURL,
    get description () {
        return formatMessage({
            defaultMessage: 'Baby SAM Bot',
            description: 'Description for the \'Baby SAM Bot\' extension',
            id: 'sambot.entry.description'
        });
    },
    tags: [],
    featured: true,
    disabled: false,
    bluetoothRequired: true,
    internetConnectionRequired: false,
    helpLink: 'https://Rbel12b.github.io/scratch-samlabs/',
    setFormatMessage: formatter => {
        formatMessage = formatter;
    },
    translationMap: translations
};

export {entry}; // loadable-extension needs this line.
export default entry;
