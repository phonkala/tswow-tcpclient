"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
/*
 * This file is part of tswow (https://github.com/tswow)
 *
 * Copyright (C) 2020 tswow <https://github.com/tswow/>
 * This program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
process.argv.push('--ipaths=./');
const Commands_1 = require("../util/Commands");
const FileSystem_1 = require("../util/FileSystem");
const Paths_1 = require("../util/Paths");
const Platform_1 = require("../util/Platform");
const Terminal_1 = require("../util/Terminal");
const Timer_1 = require("../util/Timer");
const Addon_1 = require("./Addon");
const AuthServer_1 = require("./AuthServer");
const Client_1 = require("./Client");
const CommandActions_1 = require("./CommandActions");
const Crashes_1 = require("./Crashes");
const Datascripts_1 = require("./Datascripts");
const Dataset_1 = require("./Dataset");
const Launcher_1 = require("./Launcher");
const Livescripts_1 = require("./Livescripts");
const MapData_1 = require("./MapData");
const MiscCommands_1 = require("./MiscCommands");
const Modules_1 = require("./Modules");
const MySQL_1 = require("./MySQL");
const NodeConfig_1 = require("./NodeConfig");
const Package_1 = require("./Package");
const PositionsFile_1 = require("./PositionsFile");
const Realm_1 = require("./Realm");
const Snippets_1 = require("./Snippets");
const TSTLHack_1 = require("./TSTLHack");
const path = __importStar(require("path"));
const timer = Timer_1.Timer.start();

// BEGIN: TCP server.
const net = require('net');
const tcpPort = 8124;
async function handleTCPCommand(socket, data) {
    const command = data.toString().trim();
    Modules_1.Module.cacheEndpoints(true);
    const originalStdoutWrite = process.stdout.write.bind(process.stdout);
    const originalStderrWrite = process.stderr.write.bind(process.stderr);
    process.stdout.write = (chunk, encoding, callback) => {
        socket.write(chunk.toString(), encoding, callback);
        originalStdoutWrite(chunk, encoding, callback);
    };
    process.stderr.write = (chunk, encoding, callback) => {
        socket.write(chunk.toString(), encoding, callback);
        originalStderrWrite(chunk, encoding, callback);
    };
    try {
        await Commands_1.commands.sendCommand(command);
    } catch (error) {
        socket.write(`Error executing command: ${error.message}`);
    } finally {
        process.stdout.write = originalStdoutWrite;
        process.stderr.write = originalStderrWrite;
        Modules_1.Module.cacheEndpoints(false);
        socket.end();
    }
}
const server = net.createServer((socket) => {
    socket.on('data', (data) => {
        handleTCPCommand(socket, data).catch((error) => {
            socket.write(`Error handling command: ${error.message}`);
            socket.end();
        });
    });
    socket.on('error', (err) => {
        if (err.code !== 'ECONNRESET') {
            // Handle non-ECONNRESET errors if necessary
        }
    });
});
server.listen(tcpPort, () => {
    // Server is now listening on the specified port
});
// END: TCP server.

async function initTerminal() {
    Terminal_1.term.debug('misc', `Initializing terminal`);
    await Terminal_1.term.Initialize(Paths_1.ipaths.coredata.terminal_history_txt.get(), NodeConfig_1.NodeConfig.TerminalHistory, NodeConfig_1.NodeConfig.TerminalTimestamps, NodeConfig_1.NodeConfig.TerminalNames);
    Terminal_1.term.log('mysql', `TSWoW started up in ${timer.timeSec()}s`);
    CommandActions_1.CleanCommand.addCommand('filecache', '', '', args => {
        Paths_1.ipaths.bin.changes.remove();
        Terminal_1.term.log('mysql', `Removed ${Paths_1.ipaths.bin.changes.abs().get()}`);
    });
    await Commands_1.commands.enterLoop((input) => {
        Modules_1.Module.cacheEndpoints(true);
        Commands_1.commands.sendCommand(input);
        Modules_1.Module.cacheEndpoints(false);
    });
}
async function main() {
    Terminal_1.term.log('mysql', `TSWoW Starting Up`);
    if (process.argv.includes('terminal-only')) {
        return initTerminal();
    }
    let wd = FileSystem_1.wfs.absPath('./');
    if (wd.includes(' ')) {
        Terminal_1.term.error('misc', `Invalid installation path: ${wd}\n`
            + `You cannot have spaces in the path leading up to your tswow installation,`
            + `please move it and try again.\n`);
        process.exit(0);
    }
    const isServerMode = process.argv.includes('server-mode');
    if ((0, Platform_1.isWindows)() && path.resolve(NodeConfig_1.NodeConfig.DefaultClient).charAt(0) != path.resolve(process.cwd()).charAt(0) && !isServerMode) {
        Terminal_1.term.error('client', `Invalid client: ${NodeConfig_1.NodeConfig.DefaultClient} is on different drive from TSWoW installation.\n\n`
            + `TSWoW must be installed on the same drive as the client,`
            + ` please move TSWoW and the WoW client to the same drive.`);
        process.exit(0);
    }
    if (!FileSystem_1.wfs.exists(NodeConfig_1.NodeConfig.DefaultClient) && !isServerMode) {
        Terminal_1.term.error('client', `Invalid client: ${NodeConfig_1.NodeConfig.DefaultClient} does not exist.\n\n`
            + `TSWoW requires a valid client to be able to function,`
            + ` please enter one out in node.conf`);
        process.exit(0);
    }
    if (NodeConfig_1.NodeConfig.DefaultClient.includes(' ') && !isServerMode) {
        Terminal_1.term.error('client', `Invalid client path: ${wd}\n`
            + `You cannot have spaces in the path leading up to your client,`
            + `please move it and try again.\n`);
        process.exit(0);
    }
    (0, TSTLHack_1.applyTSTLHack)();
    Modules_1.Module.cacheEndpoints(true);
    await MySQL_1.mysql.initialize();
    if (process.argv.includes('mysql-only')) {
        return initTerminal();
    }
    if (process.argv.includes('auth-only')) {
        await AuthServer_1.AuthServer.initializeDatabase();
        await AuthServer_1.AuthServer.initializeServer();
        return initTerminal();
    }
    await Dataset_1.Dataset.initialize();
    await Client_1.Client.initialize();
    await Modules_1.Module.initialize();
    await Snippets_1.Snippets.initialize();
    await AuthServer_1.AuthServer.initializeDatabase();
    await Realm_1.Realm.initialize();
    await AuthServer_1.AuthServer.initializeServer();
    if (process.argv.includes('realm-only')) {
        return initTerminal();
    }
    await Datascripts_1.Datascripts.initialize();
    if (process.argv.includes('data-only')) {
        return initTerminal();
    }
    await Livescripts_1.Livescripts.initialize();
    if (process.argv.includes('scripts-only')) {
        return initTerminal();
    }
    await Addon_1.Addon.initialize();
    if (process.argv.includes('addon-only')) {
        return initTerminal();
    }
    await MapData_1.MapData.initialize();
    await Package_1.Package.initialize();
    await Crashes_1.Crashes.initialize();
    await PositionsFile_1.PositionsFile.initialize();
    await MiscCommands_1.MiscCommands.initialize();
    await Launcher_1.Launcher.initialize();
    Modules_1.Module.cacheEndpoints(false);
    return initTerminal();
}
exports.main = main;
main();
//# sourceMappingURL=TSWoW.js.map