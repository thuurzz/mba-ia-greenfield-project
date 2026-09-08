import { ValueTransformer } from 'typeorm';

export const ulidTransformer: ValueTransformer = {
  to: (value: string) => value,
  from: (value: string) => value,
};
