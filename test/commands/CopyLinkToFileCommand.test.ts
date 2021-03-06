import { expect } from 'chai';
import * as sinon from 'sinon';
import {
    commands,
    env,
    MessageItem,
    MessageOptions,
    Uri,
    window,
    workspace
} from 'vscode';

import { CopyLinkToFileCommand } from '../../src/commands/CopyLinkToFileCommand';
import { LinkTypeProvider } from '../../src/configuration/LinkTypeProvider';
import { LinkHandler } from '../../src/links/LinkHandler';
import { WorkspaceMap } from '../../src/utilities/WorkspaceMap';

import {
    FINAL_URL,
    GIT_INFO,
    MockLinkHandler,
    WORKSPACE_FOLDER
} from '../test-helpers/MockLinkHandler';

describe('CopyLinkToFileCommand', () => {
    let writeTextStub: sinon.SinonStub<[string], Thenable<void>>;
    let command: CopyLinkToFileCommand | undefined;

    beforeEach(() => {
        sinon.stub(LinkTypeProvider.prototype, 'getLinkType').returns('branch');
        writeTextStub = sinon
            .stub(env.clipboard, 'writeText')
            .returns(Promise.resolve());
    });

    afterEach(() => {
        if (command) {
            command.dispose();
            command = undefined;
        }

        sinon.restore();
    });

    it('should unregister the command when disposed.', async () => {
        let all: string[];
        let map: WorkspaceMap;

        map = new WorkspaceMap();
        map.add(WORKSPACE_FOLDER, GIT_INFO, new MockLinkHandler());

        command = new CopyLinkToFileCommand(map);

        all = await commands.getCommands();
        expect(all).to.contain('gitweblinks.copyFile');

        command.dispose();
        command = undefined;

        all = await commands.getCommands();
        expect(all).to.not.contain('gitweblinks.copyFile');
    });

    it('should not use a line selection.', async () => {
        let handler: MockLinkHandler;
        let map: WorkspaceMap;

        handler = new MockLinkHandler();

        map = new WorkspaceMap();
        map.add(WORKSPACE_FOLDER, GIT_INFO, handler);

        command = new CopyLinkToFileCommand(map);

        await commands.executeCommand(
            'gitweblinks.copyFile',
            Uri.file(`${GIT_INFO.rootDirectory}foo.txt`)
        );

        expect(handler.selection).to.be.undefined;
    });

    it('should copy the URL to the clipboard.', async () => {
        let map: WorkspaceMap;
        let handler: LinkHandler;

        handler = new MockLinkHandler();

        map = new WorkspaceMap();
        map.add(WORKSPACE_FOLDER, GIT_INFO, handler);

        sinon.stub(map, 'get').returns({
            handler,
            gitInfo: GIT_INFO
        });

        sinon.stub(workspace, 'getWorkspaceFolder').returns(WORKSPACE_FOLDER);

        command = new CopyLinkToFileCommand(map);

        await commands.executeCommand(
            'gitweblinks.copyFile',
            Uri.file(`${GIT_INFO.rootDirectory}foo.txt`)
        );

        expect(writeTextStub.calledWith(FINAL_URL)).to.be.true;
    });

    it('should use the active document when no resource is passed.', async () => {
        let map: WorkspaceMap;
        let handler: LinkHandler;

        handler = new MockLinkHandler();

        map = new WorkspaceMap();
        map.add(WORKSPACE_FOLDER, GIT_INFO, handler);

        sinon.stub(map, 'get').returns({
            handler,
            gitInfo: GIT_INFO
        });

        sinon.stub(workspace, 'getWorkspaceFolder').returns(WORKSPACE_FOLDER);
        sinon.stub(window, 'activeTextEditor').value({
            document: { uri: Uri.file(`${GIT_INFO.rootDirectory}foo.txt`) }
        });

        command = new CopyLinkToFileCommand(map);

        await commands.executeCommand('gitweblinks.copyFile');

        expect(writeTextStub.calledWith(FINAL_URL)).to.be.true;
    });

    it('should show a notification when no resource is passed and there is no active document.', async () => {
        let map: WorkspaceMap;
        let showErrorMessage: sinon.SinonStub<
            [string, MessageOptions, ...MessageItem[]],
            Thenable<MessageItem | undefined>
        >;

        map = new WorkspaceMap();

        sinon.stub(workspace, 'getWorkspaceFolder').returns(WORKSPACE_FOLDER);
        sinon.stub(window, 'activeTextEditor').value(undefined);
        showErrorMessage = sinon.stub(window, 'showErrorMessage');

        command = new CopyLinkToFileCommand(map);

        await commands.executeCommand('gitweblinks.copyFile');

        expect(writeTextStub.called).to.be.false;
        expect(showErrorMessage.called).to.be.true;
    });

    it('should show a notification when the file is not in a workspace.', async () => {
        let map: WorkspaceMap;
        let showErrorMessage: sinon.SinonStub<
            [string, MessageOptions, ...MessageItem[]],
            Thenable<MessageItem | undefined>
        >;

        map = new WorkspaceMap();

        sinon.stub(workspace, 'getWorkspaceFolder').returns(undefined);
        sinon.stub(window, 'activeTextEditor').value(undefined);
        showErrorMessage = sinon.stub(window, 'showErrorMessage');

        command = new CopyLinkToFileCommand(map);

        await commands.executeCommand(
            'gitweblinks.copyFile',
            Uri.file(`${GIT_INFO.rootDirectory}foo.txt`)
        );

        expect(writeTextStub.called).to.be.false;
        expect(showErrorMessage.called).to.be.true;
    });

    it('should show a notification if the workspace is not in Git.', async () => {
        let map: WorkspaceMap;
        let showErrorMessage: sinon.SinonStub<
            [string, MessageOptions, ...MessageItem[]],
            Thenable<MessageItem | undefined>
        >;

        map = new WorkspaceMap();

        sinon.stub(workspace, 'getWorkspaceFolder').returns(WORKSPACE_FOLDER);
        showErrorMessage = sinon.stub(window, 'showErrorMessage');

        command = new CopyLinkToFileCommand(map);

        await commands.executeCommand(
            'gitweblinks.copyFile',
            Uri.file(`${GIT_INFO.rootDirectory}foo.txt`)
        );

        expect(writeTextStub.called).to.be.false;
        expect(showErrorMessage.called).to.be.true;
    });

    it('should show an error notification if the link handler throws an error.', async () => {
        let map: WorkspaceMap;
        let handler: LinkHandler;
        let showErrorMessage: sinon.SinonStub<
            [string, MessageOptions, ...MessageItem[]],
            Thenable<MessageItem | undefined>
        >;

        handler = new MockLinkHandler();
        sinon.stub(handler, 'makeUrl').rejects(new Error('Boom'));

        map = new WorkspaceMap();
        map.add(WORKSPACE_FOLDER, GIT_INFO, handler);

        sinon.stub(map, 'get').returns({
            handler,
            gitInfo: GIT_INFO
        });

        sinon.stub(workspace, 'getWorkspaceFolder').returns(WORKSPACE_FOLDER);
        showErrorMessage = sinon.stub(window, 'showErrorMessage');

        command = new CopyLinkToFileCommand(map);

        await commands.executeCommand(
            'gitweblinks.copyFile',
            Uri.file(`${GIT_INFO.rootDirectory}foo.txt`)
        );

        expect(writeTextStub.called).to.be.false;
        expect(showErrorMessage.called).to.be.true;
    });
});
