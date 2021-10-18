import compression from 'compression';
import cors from 'cors';
import {Request, Response} from "express";
import express from 'express';
import { Server } from 'http';
import http from 'http';
import {CodyConfig, ElementEdited, handleElementEdited, Sync} from './board/code';
import {makeNodeRecord, Node} from './board/graph';
import { greeting, IioSaidHello } from './general/greeting';
import { checkQuestion, handleReply, Reply, test } from './general/question';
import {CodyResponse, CodyResponseType} from './general/response';
import {Map} from "immutable";
// tslint:disable-next-line:no-var-requires
const bodyParser = require('body-parser');

const codyServer = (codyConfig: CodyConfig): Server => {

    const app = express();

    const options: cors.CorsOptions = {
        allowedHeaders: [
            'Origin',
            'X-Requested-With',
            'Content-Type',
            'Accept',
            'X-Access-Token',
            'Authorization'
        ],
        credentials: true,
        methods: 'GET,HEAD,OPTIONS,PUT,PATCH,POST,DELETE',
        origin: '*',
        preflightContinue: false,
    };

    // GZIP compress resources served
    app.use(compression());
    app.use(cors(options));
    app.use(bodyParser.json());

    // Force redirect to HTTPS if the protocol was HTTP
    // if (!process.env.LOCAL) {
    //     app.use( enforce.HTTPS( { trustProtoHeader: true } ) );
    // }

    const server = http.createServer(app);

    enum Events {
        IioSaidHello= 'IioSaidHello',
        UserReplied = 'UserReplied',
        ElementEdited = 'ElementEdited',
        ConfirmTest = 'ConfirmTest',
    }

    enum Commands {
        Sync= 'Sync',
        SyncDeleted= 'SyncDeleted'
    }

    app.post(`/messages/${Events.IioSaidHello}`, (req: Request<any, CodyResponse, IioSaidHello>, res: Response<CodyResponse>) => {
        console.log(Events.IioSaidHello);

        codyConfig.context.syncRequired = true;

        res.send(greeting(req.body.user))
    });

    app.post(`/messages/${Events.UserReplied}`, (req: Request<any, CodyResponse, Reply>, res: Response<CodyResponse>) => {
        console.log(Events.UserReplied, req.body);

        handleReply(req.body.reply).then(codyRes => {
            res.send(checkQuestion(codyRes));
        }, reason => {
            res.send({
                cody: "Look's like something went wrong!",
                details: reason.toString(),
                type: CodyResponseType.Error
            });
        });
    });

    app.post(`/messages/${Events.ElementEdited}`, (req: Request<any, CodyResponse, ElementEdited>, res: Response<CodyResponse>) => {
        console.log(Events.ElementEdited, req.body);

        if(codyConfig.context.syncRequired) {
            codyConfig.context.syncedNodes = Map<string, Node>();

            res.send({
                cody: 'I need to sync all elements first.',
                details: "Lean back for a moment. I'll let you know when I'm done.",
                type: CodyResponseType.SyncRequired
            })
            return;
        }

        handleElementEdited(makeNodeRecord(req.body.node), codyConfig).then(codyRes => {
            res.send(checkQuestion(codyRes));
        }, reason => {
            console.log(reason);
            res.send({
                cody: `Uh, sorry. Cannot handle element ${makeNodeRecord(req.body.node).getName()}!`,
                details: reason.toString(),
                type: CodyResponseType.Error
            });
        });
    });

    app.post(`/messages/${Commands.Sync}`, (req: Request<any, CodyResponse, Sync>, res: Response<CodyResponse>) => {
        console.log(Commands.Sync, "full sync");

        codyConfig.context.syncRequired = false;

        let nodes: Node[] = [];

        if(req.body.nodes && Array.isArray(req.body.nodes)) {
            nodes = req.body.nodes.map(makeNodeRecord);
        } else {
            res.send({
                cody: 'No nodes given in sync request!',
                type: CodyResponseType.Error
            })
            return;
        }

        nodes.forEach(node => {
            console.log("synced node: ", node.getName());
            codyConfig.context.syncedNodes = codyConfig.context.syncedNodes.set(node.getId(), node);
        })

        res.send({
            cody: '',
            type: CodyResponseType.Empty
        });
    });

    app.put(`/messages/${Commands.Sync}`, (req: Request<any, CodyResponse, Sync>, res: Response<CodyResponse>) => {
        console.log(Commands.Sync, "edit sync");

        if(codyConfig.context.syncRequired) {
            // Seems like server lost in-memory sync due to restart but InspectIO continues to send sync requests
            // Ignore sync until user triggers next code generation and therefore next full sync
            console.log("sync ignored");
            res.send({
                cody: '',
                type: CodyResponseType.Empty
            });
            return;
        }

        let nodes: Node[] = [];

        if(req.body.nodes && Array.isArray(req.body.nodes)) {
            nodes = req.body.nodes.map(makeNodeRecord);
        } else {
            res.send({
                cody: 'No nodes given in sync request!',
                type: CodyResponseType.Error
            })
            return;
        }

        nodes.forEach(node => {
            console.log("synced node: ", node.getName(), `(${node.getId()} - ${node.getType()})`, "parent: ", node.getParent()? node.getParent()!.getId() : '-');
            codyConfig.context.syncedNodes = codyConfig.context.syncedNodes.set(node.getId(), node);
        })

        res.send({
            cody: '',
            type: CodyResponseType.Empty
        });
    });

    app.post(`/messages/${Commands.SyncDeleted}`, (req: Request<any, CodyResponse, Sync>, res: Response<CodyResponse>) => {
        console.log(Commands.SyncDeleted);

        if(codyConfig.context.syncRequired) {
            // Seems like server lost in-memory sync due to restart but InspectIO continues to sent sync requests
            // Ignore sync until user triggers next code generation and therefore next full sync
            console.log("sync ignored");
            res.send({
                cody: '',
                type: CodyResponseType.Empty
            });
            return;
        }

        let nodes: Node[] = [];

        if(req.body.nodes && Array.isArray(req.body.nodes)) {
            nodes = req.body.nodes.map(makeNodeRecord);
        } else {
            res.send({
                cody: 'No nodes given in sync request!',
                type: CodyResponseType.Error
            })
            return;
        }

        nodes.forEach(node => {
            console.log("synced node: ", node.getName(), `(${node.getId()} - ${node.getType()})`, "parent: ", node.getParent()? node.getParent()!.getId() : '-');
            codyConfig.context.syncedNodes = codyConfig.context.syncedNodes.delete(node.getId());
        })

        res.send({
            cody: '',
            type: CodyResponseType.Empty
        });
    });

    app.post(`/messages/${Events.ConfirmTest}`, (req: Request<any, CodyResponse, any>, res: Response<CodyResponse>) => {
        console.log(Events.ConfirmTest);

        res.send(checkQuestion(test()));
    });

    return server;
}

export default codyServer;
