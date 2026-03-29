import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OptionContract } from './entities/option-contract.entity';
import { OptionOrder } from './entities/option-order.entity';
import { OptionPosition } from './entities/option-position.entity';
import { OptionsController } from './options.controller';
import { OptionsService } from './options.service';

@Module({
  imports: [TypeOrmModule.forFeature([OptionContract, OptionOrder, OptionPosition])],
  controllers: [OptionsController],
  providers: [OptionsService],
  exports: [OptionsService],
})
export class OptionsModule {}
