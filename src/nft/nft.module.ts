import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NftMarketplaceService } from './nft-marketplace.service';
import { FractionalNftService } from './fractional-nft.service';
import { NftLendingService } from './nft-lending.service';
import { NftController } from './nft.controller';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [NftController],
  providers: [NftMarketplaceService, FractionalNftService, NftLendingService],
  exports: [NftMarketplaceService, FractionalNftService, NftLendingService],
})
export class NftModule {}
