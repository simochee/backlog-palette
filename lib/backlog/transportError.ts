/*
 * fetch が応答を返さずに終わった。TypeError で見分けないのは、応答を行に加工する途中の
 * バグも TypeError になるため。Firefox で background に委譲した fetch の失敗は
 * メッセージング越しに name だけ TypeError の素の Error で届くので、種類でも絞らない。
 * CORS の拒否も同じ形で届くため、名前は Network ではなく「応答が無い」に留める。
 * AbortSignal やタイムアウトを入れると中止もここに入ってオフラインに見えるので、そのときは中止を先に分ける
 */
export class TransportError extends Error {
  constructor(cause: unknown) {
    super('no response', { cause });
    this.name = 'TransportError';
  }
}
