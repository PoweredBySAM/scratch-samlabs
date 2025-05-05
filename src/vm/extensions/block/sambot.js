import BlockType from '../../extension-support/block-type';
import ArgumentType from '../../extension-support/argument-type';
import translations from './translations.json';
import {SamLabsBLE, DeviceTypes, BabyBotIndex, SAMDevice} from './device';

/**
 * Formatter which is used for translation.
 * This will be replaced which is used in the runtime.
 * @param {object} messageData - format-message object
 * @returns {string} - message for the locale
 */
let formatMessage = messageData => messageData.default;

/**
 * Setup format-message for this extension.
 */
const setupTranslations = () => {
    const localeSetup = formatMessage.setup();
    if (localeSetup && localeSetup.translations[localeSetup.locale]) {
        Object.assign(
            localeSetup.translations[localeSetup.locale],
            translations[localeSetup.locale]
        );
    }
};

const EXTENSION_ID = 'sambot';

/**
 * URL to get this extension as a module.
 * When it was loaded as a module, 'extensionURL' will be replaced a URL which is retrieved from.
 * @type {string}
 */
let extensionURL = 'https://Rbel12b.github.io/Scratch/dist/sambot.mjs';

/**
 * Scratch 3.0 blocks for example of Xcratch.
 */
class ExtensionBlocks {
    /**
     * A translation object which is used in this class.
     * @param {FormatObject} formatter - translation object
     */
    static set formatMessage (formatter) {
        formatMessage = formatter;
        if (formatMessage) setupTranslations();
    }

    /**
     * @return {string} - the name of this extension.
     */
    static get EXTENSION_NAME () {
        return formatMessage({
            id: 'sambot.name',
            default: 'Baby SAM Bot',
            description: 'name of the extension'
        });
    }

    /**
     * @return {string} - the ID of this extension.
     */
    static get EXTENSION_ID () {
        return EXTENSION_ID;
    }

    /**
     * URL to get this extension.
     * @type {string}
     */
    static get extensionURL () {
        return extensionURL;
    }

    /**
     * Set URL to get this extension.
     * The extensionURL will be changed to the URL of the loading server.
     * @param {string} url - URL
     */
    static set extensionURL (url) {
        extensionURL = url;
    }

    /**
     * Construct a set of blocks for Baby SAM Bot.
     * @param {Runtime} runtime - the Scratch 3.0 runtime.
     */
    constructor (runtime) {
        /**
         * The Scratch 3.0 runtime.
         * @type {Runtime}
         */
        this.runtime = runtime;

        if (runtime.formatMessage) {
            // Replace 'formatMessage' to a formatter which is used in the runtime.
            formatMessage = runtime.formatMessage;
        }
        this.deviceMap = new Map(); // Store multiple devices
        this.numberOfConnectedDevices = 0;
        this.extensionId = 'sambot';
        this._stopAll = this.stopAll.bind(this);
        this.runtime.on('PROJECT_STOP_ALL', this._stopAll);
        this.runtime.on('PROJECT_RUN_STOP', this._stopAll);
        this.deviceMenu = [];
        this.DeviceMapping = new Map();

        this.runtime.registerPeripheralExtension(this.extensionId, this);
        this.connectToDevice = this.connectToDevice.bind(this);
    }

    /**
     * @returns {object} metadata for this extension and its blocks.
     */
    getInfo () {
        setupTranslations();
        return {
            id: ExtensionBlocks.EXTENSION_ID,
            name: ExtensionBlocks.EXTENSION_NAME,
            extensionURL: ExtensionBlocks.extensionURL,
            showStatusButton: false,
            color1: '#0FBD8C',
            color2: '#0DA57A',
            blocks: [
                {
                    func: 'CONNECT_SAMBOT',
                    blockType: BlockType.BUTTON,
                    text: formatMessage({
                        id: 'samlabs.connectToDevice', // same as samlabs extension's connec to device block, not typo
                        default: 'Connect a device'
                    })
                },
                {
                    opcode: 'getBattery',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'sambot.getBattery',
                        default: 'Battery percentage, Baby SAM Bot[num]'
                    }),
                    terminal: false,
                    arguments: {
                        num: {menu: 'deviceMenu', type: ArgumentType.NUMBER}
                    }
                },
                {
                    opcode: 'BabyBotExecCommand',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'sambot.BabyBotExecCommand',
                        default: 'Baby SAM Bot[num] [command]'
                    }),
                    terminal: false,
                    arguments: {
                        num: {menu: 'deviceMenu', type: ArgumentType.NUMBER},
                        command: {menu: 'babyBotCommand', type: ArgumentType.STRING}
                    }
                },
                {
                    opcode: 'BabyBotPushCommand',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'sambot.BabyBotPushCommand',
                        default: 'Baby SAM Bot[num] push [command] to itiner'
                    }),
                    terminal: false,
                    arguments: {
                        num: {menu: 'deviceMenu', type: ArgumentType.NUMBER},
                        command: {menu: 'babyBotCommand', type: ArgumentType.STRING}
                    }
                },
                {
                    opcode: 'BabyBotStart',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'sambot.BabyBotStart',
                        default: 'Baby SAM Bot[num] start'
                    }),
                    terminal: false,
                    arguments: {
                        num: {menu: 'deviceMenu', type: ArgumentType.NUMBER}
                    }
                },
                {
                    opcode: 'BabyBotStop',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'sambot.BabyBotStop',
                        default: 'Baby SAM Bot[num] stop'
                    }),
                    terminal: false,
                    arguments: {
                        num: {menu: 'deviceMenu', type: ArgumentType.NUMBER}
                    }
                },
                {
                    opcode: 'BabyBotClear',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'sambot.BabyBotClear',
                        default: 'Baby SAM Bot[num] clear itiner'
                    }),
                    terminal: false,
                    arguments: {
                        num: {menu: 'deviceMenu', type: ArgumentType.NUMBER}
                    }
                },
                {
                    opcode: 'BabyBotWrite',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'sambot.BabyBotWrite',
                        default: 'Baby SAM Bot[num] set motor speed right [r], left [l]'
                    }),
                    terminal: false,
                    arguments: {
                        num: {menu: 'deviceMenu', type: ArgumentType.NUMBER},
                        r: {defaultValue: 0, type: ArgumentType.NUMBER},
                        l: {defaultValue: 0, type: ArgumentType.NUMBER}
                    }
                }
            ],
            menus: {
                deviceMenu: 'getDeviceMenu',
                babyBotCommand: {
                    acceptReporters: true,
                    items: [
                        {
                            text: formatMessage({
                                id: 'sambot.commandMenu.forward',
                                default: 'move forward'
                            }),
                            value: 'F'
                        },
                        {
                            text: formatMessage({
                                id: 'sambot.commandMenu.backward',
                                default: 'move backward'
                            }),
                            value: 'B'
                        },
                        {
                            text: formatMessage({
                                id: 'sambot.commandMenu.right',
                                default: 'turn right'
                            }),
                            value: 'R'
                        },
                        {
                            text: formatMessage({
                                id: 'sambot.commandMenu.left',
                                default: 'turn left'
                            }),
                            value: 'L'
                        }
                    ]
                }
            }
        };
    }

    updateDeviceMenu () {
        this.deviceMenu = [];
        this.deviceMap.forEach(device => {
            this.deviceMenu.push({text: device.displayName, value: device.id});
        });
    }

    getDeviceMenu () {
        return this.deviceMenu.length ? this.deviceMenu : [{text: '-', value: '-'}];
    }

    /**
     * get the device with the given id
     * @param {string} id the device id
     * @returns {SAMDevice} the device
     */
    getDeviceFromId (id) {
        if (this.DeviceMapping.get(id)) {
            return this.deviceMap.get(this.DeviceMapping.get(id));
        }
        return this.deviceMap.get(id);
    }

    stopAll () {
        this.deviceMap.forEach(this.stopDevice.bind(this));
    }

    stopDevice (device) {
        device.writeActor(new Uint8Array([0, 0, 0]), false);
    }

    async connectToDevice () {
        const device = new SAMDevice(this.runtime, this.extensionId);
        const connected = await device.connectToDevice(this.deviceMap, {
            filters: [{
                namePrefix: DeviceTypes[BabyBotIndex].advName
            }],
            optionalServices: [SamLabsBLE.battServ, SamLabsBLE.SAMServ]
        });
        if (connected) {
            if (device.device.name !== DeviceTypes[BabyBotIndex].advName) {
                device._ble.disconnect();
                return;
            }
            device.displayName = String(device.sameDevices);
            this.deviceMap.set(device.id, device);
            this.updateDeviceMenu();
        }
    }

    getBattery (args) {
        const block = this.getDeviceFromId(args.num);
        if (!block) {
            return 0;
        }
        return block.battery;
    }

    /**
     * send a command to a SamBot
     * @param {SAMDevice} device the device
     * @param {Uint8Array} bytearray the message
     * @returns {void}
     */
    async BabyBotCommand (device, bytearray) {
        if (!device.SAMBotAvailable) {
            return;
        }
        await device.writeBot(bytearray);
    }

    async BabyBotExecCommand (args) {
        const block = this.getDeviceFromId(args.num);
        if (!block) {
            return;
        }
        await this.BabyBotCommand(block, new Uint8Array([args.command.charCodeAt(0), 'e'.charCodeAt(0), 0]));
    }

    async BabyBotPushCommand (args) {
        const block = this.getDeviceFromId(args.num);
        if (!block) {
            return;
        }
        await this.BabyBotCommand(block, new Uint8Array([args.command.charCodeAt(0), 's'.charCodeAt(0), 0]));
    }
    async BabyBotStart (args) {
        const block = this.getDeviceFromId(args.num);
        if (!block) {
            return;
        }
        await this.BabyBotCommand(block, new Uint8Array(['X'.charCodeAt(0), 'e'.charCodeAt(0), 0]));
    }
    async BabyBotStop (args) {
        const block = this.getDeviceFromId(args.num);
        if (!block) {
            return;
        }
        await this.BabyBotCommand(block, new Uint8Array(['S'.charCodeAt(0), 'e'.charCodeAt(0), 0]));
    }
    async BabyBotClear (args) {
        const block = this.getDeviceFromId(args.num);
        if (!block) {
            return;
        }
        await this.BabyBotCommand(block, new Uint8Array(['C'.charCodeAt(0), 'e'.charCodeAt(0), 0]));
    }
    async BabyBotWrite (args) {
        const block = this.getDeviceFromId(args.num);
        if (!block || !block.SAMBotAvailable) {
            return;
        }
        let Lspeed = Number(args.l);
        if (Lspeed < 0) {
            if (Lspeed < -100) {
                Lspeed = -100;
            }
            Lspeed = ((100 - Math.abs(Lspeed)) * 1.28) + 128;
        } else {
            if (Lspeed > 100) {
                Lspeed = 100;
            }
            Lspeed = Lspeed * 1.27;
        }
        let Rspeed = Number(args.r);
        if (Rspeed < 0) {
            if (Rspeed < -100) {
                Rspeed = -100;
            }
            Rspeed = ((100 - Math.abs(Rspeed)) * 1.28) + 128;
        } else {
            if (Rspeed > 100) {
                Rspeed = 100;
            }
            Rspeed = Rspeed * 1.27;
        }
        await block.writeActor(new Uint8Array([Rspeed, Lspeed, 0]));
    }
}

export {ExtensionBlocks as default, ExtensionBlocks as blockClass};
