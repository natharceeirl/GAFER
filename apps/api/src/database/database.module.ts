import { Global, Module } from '@nestjs/common';
import { Kysely } from 'kysely';
import { GaferDatabase } from './types';
import { createDatabasePool, createKyselyDatabase } from './connection';

export const KYSELY_DATABASE = Symbol('KYSELY_DATABASE');

@Global()
@Module({
  providers: [
    {
      provide: KYSELY_DATABASE,
      useFactory: () => {
        const pool = createDatabasePool();
        return createKyselyDatabase(pool);
      },
    },
    {
      provide: Kysely,
      useExisting: KYSELY_DATABASE,
    },
  ],
  exports: [KYSELY_DATABASE, Kysely],
})
export class DatabaseModule {}
