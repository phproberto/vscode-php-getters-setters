'use strict';

import * as vscode from 'vscode';

export default class Configuration {
    private config : vscode.WorkspaceConfiguration;

    public constructor()
    {
        this.config = vscode.workspace.getConfiguration('phpGettersSetters');
    }

    get(key: string, defaultValue) {
        return this.config.get(key, defaultValue);
    }

    getInt(key: string, defaultValue : number) : number {
        return parseInt(this.get(key, defaultValue));
    }
}
