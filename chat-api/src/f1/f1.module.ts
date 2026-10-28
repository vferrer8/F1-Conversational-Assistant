import { Module } from '@nestjs/common';
import { F1Controller } from './f1.controller';

@Module({ controllers: [F1Controller] })
export class F1Module {}
