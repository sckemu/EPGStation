import { inject, injectable } from 'inversify';
import internal from 'stream';
import * as apid from '../../../../api';
import ILogger from '../../ILogger';
import ILoggerModel from '../../ILoggerModel';
import { IStreamBase } from './IStreamBaseModel';
import IStreamManageModel from './IStreamManageModel';

@injectable()
export default class StreamManageModel implements IStreamManageModel {
    private log: ILogger;
    private streams: { [streamId: number]: IStreamBase<any> } = {};

    constructor(@inject('ILoggerModel') logger: ILoggerModel) {
        this.log = logger.getLogger();
    }

    /**
     * ストリームを開始する
     * @param stream: IStreamBase<any> setOption() した状態で渡す
     * @return Promise<apid.StreamId>
     */
    public async start(stream: IStreamBase<any>): Promise<apid.StreamId> {
        // ストリーム開始
        this.log.stream.info('start stream');

        // stream id 割当
        const streamId = this.getEmptyStreamId();
        this.streams[streamId] = stream;

        await stream.start(streamId).catch(err => {
            this.log.stream.error('start stream error');
            this.log.stream.error(err);
            throw err;
        });

        // stream 停止時に停止させる
        stream.setExitStream(() => {
            this.stop(streamId);
        });

        this.log.stream.info(`set new stream: ${streamId.toString(10)}`);

        return streamId;
    }

    /**
     * 空いている streamId を返す
     * @return apid.StreamId
     */
    private getEmptyStreamId(): apid.StreamId {
        let newStreamId = 0;
        while (true) {
            if (typeof this.streams[newStreamId] === 'undefined') {
                return newStreamId;
            }

            newStreamId++;
        }
    }

    /**
     * ストリームを停止する
     * @param streamId: apid.StreamId
     * @return Promise<void>
     */
    public async stop(streamId: apid.StreamId): Promise<void> {
        if (typeof this.streams[streamId] === 'undefined') {
            return;
        }

        await this.streams[streamId].stop();
        delete this.streams[streamId];

        this.log.stream.info(`stop stream ${streamId}`);
    }

    /**
     * すべてのストリームを停止する
     */
    public async stopAll(): Promise<void> {
        for (const streamId in this.streams) {
            await this.stop(parseInt(streamId, 10)).catch(err => {
                this.log.system.error(err);
            });
        }
    }

    /**
     * ストリーム情報を返す
     * @param streamId: apid.StreamId
     * @return apid.LiveStreamInfo | apid.RecordedStreamInfo
     */
    public getStreamInfo(streamId: apid.StreamId): apid.LiveStreamInfo | apid.RecordedStreamInfo {
        if (typeof this.streams[streamId] === 'undefined') {
            throw new Error('StreamIsNotFound');
        }

        return this.streams[streamId].getInfo();
    }

    /**
     * すべてのストリーム情報を返す
     * @return (apid.LiveStreamInfo | apid.RecordedStreamInfo)[]
     */
    public getStreamInfos(): (apid.LiveStreamInfo | apid.RecordedStreamInfo)[] {
        const result: (apid.LiveStreamInfo | apid.RecordedStreamInfo)[] = [];
        for (const streamId in this.streams) {
            result.push(this.streams[streamId].getInfo());
        }

        return result;
    }

    /**
     * 生成されたストリームを返す
     * @param streamId: apid.StreamId
     * @return internal.Readable | null
     */
    public getStream(streamId: apid.StreamId): internal.Readable | null {
        if (typeof this.streams[streamId] === 'undefined') {
            throw new Error('StreamIsNotFound');
        }

        return this.streams[streamId].getStream();
    }
}
