import {CodyResponse, CodyResponseType} from "./response";

export const greeting = (user: string): CodyResponse => {
    return {
        cody: `Hey ${user}, Cody here. Before we can start, I need to sync the board. This might take a moment.`,
        details: ["If you need guidance just ask me with: %c/help", 'background-color: rgba(251, 159, 75, 0.2)'],
        type: CodyResponseType.SyncRequired,
    }
}

export interface IioSaidHello {
    user: string;
}
