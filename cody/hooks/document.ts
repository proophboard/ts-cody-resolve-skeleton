import fs from 'fs';
import { CodyHook } from '../src/board/code';
import { Node, NodeType } from '../src/board/graph';
import { CodyResponse, CodyResponseType, isCodyError } from '../src/general/response';
import { Context } from './context';
import { extractDocumentMetadata } from './utils/metadata';
import {
    loadResolveConfig,
    loadSchemaDefinitions,
    upsertQueryConfig,
    upsertSagaConfig,
    upsertSchemaDefinitionConfig,
} from './utils/config';
import { nodeNameToPascalCase } from '../src/utils/string';

export const onDocumentHook: CodyHook<Context> = async (document: Node, ctx: Context): Promise<CodyResponse> => {
    const metadata = extractDocumentMetadata(document);
    const config = loadResolveConfig(ctx);
    const defs = loadSchemaDefinitions(ctx);

    if (isCodyError(metadata)) {
        return metadata;
    }

    if (isCodyError(config)) {
        return config;
    }

    if (isCodyError(defs)) {
        return defs;
    }

    const voName = nodeNameToPascalCase(document);

    let namespace = metadata.namespace || '/';

    if (namespace.charAt(0) !== '/') {
        namespace = '/' + namespace;
    }

    const dirNamespace = namespace.length === 1 ? '' : namespace;
    const voNameWithNs = namespace.length === 1 ? '/' + voName : namespace + '/' + voName;

    const voFilename = `${voName}.ts`;

    const voDir = ctx.feFolder + `/model/values${dirNamespace}`;

    const voFile = ctx.feFolder + `/model/values${dirNamespace}/${voFilename}`;

    const schemaDefErr = upsertSchemaDefinitionConfig(voNameWithNs, voFile, metadata.schema, defs, ctx);

    if (isCodyError(schemaDefErr)) {
        return schemaDefErr;
    }

    if (metadata.querySchema) {
        const queryConfigErr = upsertQueryConfig(voName, document.getLink(), metadata.querySchema, metadata.schema, config, ctx);

        if (isCodyError(queryConfigErr)) {
            return queryConfigErr;
        }

        const sagaConfigErr = upsertSagaConfig(`fetch${voName}Flow`, config, ctx);

        if (isCodyError(sagaConfigErr)) {
            return sagaConfigErr;
        }
    }

    let successDetails = 'Checklist\n\n';

    return {
        cody: [`%cI'm skipping "${document.getName()}" due missing implementation.`, 'color: #fb9f4b; font-weight: bold'],
        details: [`%cIf you want me to handle ${document.getName()}, implement the desired code please.`, 'color: #414141', 'background-color: rgba(251, 159, 75, 0.2)', 'color: #414141'],
        type: CodyResponseType.Info,
    };
};
