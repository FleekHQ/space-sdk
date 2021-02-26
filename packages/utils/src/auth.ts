import { PrivateKey } from '@textile/crypto';

export interface TextileStorageAuth {
  key: string;
  token: string;
  sig: string;
  msg: string;
}

/**
 * Space service Hub Auth challenge response
 *
 * @internal
 */
export interface HubAuthResponse {
  token: string;
  storageAuth?: TextileStorageAuth;
}

/**
 * Authenticates the identity of the user with the auth server at the specified endpoint
 * using spaces auth solver algorithm
 *
 * @param endpoint - Space Websocket Endpoint
 * @param identity - Private Key Identity for user
 */
export const authenticateSpaceIdentity = (
  endpoint: string,
  identity: PrivateKey,
): Promise<HubAuthResponse> => new Promise((resolve, reject) => {
  const socket = new WebSocket(endpoint);

  /** Wait for our socket to open successfully */
  socket.onopen = () => {
    const publicKey = identity.public.toString();

    /** Send a new token request */
    socket.send(
      JSON.stringify({
        data: { pubkey: publicKey, version: 2 },
        action: 'token',
      }),
    );

    /** Listen for messages from the server */
    socket.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        /** Error never happen :) */
        case 'error': {
          reject(data.value);
          break;
        }
        /** The server issued a new challenge */
        case 'challenge': {
          /** Convert the challenge json to a Buffer */
          const buf = Buffer.from(data.value.data);
          /** Use local identity to sign the challenge */
          const signed = await identity.sign(buf);

          /** Send the signed challenge back to the server */
          socket.send(
            JSON.stringify({
              action: 'challenge',
              data: { pubkey: publicKey, sig: Buffer.from(signed).toJSON() },
            }),
          );
          break;
        }
        /** New token generated */
        case 'token': {
          socket.close();
          resolve(data.value);
          break;
        }
      }
    };
  };
});
