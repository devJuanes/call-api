import type { Server } from 'socket.io';

let ioRef: Server | null = null;

export function setIo(io: Server) {
  ioRef = io;
}

export function getIo(): Server | null {
  return ioRef;
}
