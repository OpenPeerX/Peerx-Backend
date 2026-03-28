import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { NftMarketplaceService } from './nft-marketplace.service';
import { FractionalNftService } from './fractional-nft.service';
import { NftLendingService } from './nft-lending.service';

@Controller('nft')
export class NftController {
  constructor(
    private readonly marketplaceService: NftMarketplaceService,
    private readonly fractionalService: FractionalNftService,
    private readonly lendingService: NftLendingService,
  ) {}

  @Post('list')
  listNft(@Body() dto: { tokenId: string; contractAddress: string; price: string }) {
    return this.marketplaceService.listNft(dto.tokenId, dto.contractAddress, dto.price);
  }

  @Post('buy/:listingId')
  buyNft(@Param('listingId') listingId: string, @Body() dto: { buyerId: string }) {
    return this.marketplaceService.buyNft(listingId, dto.buyerId);
  }

  @Get('valuate/:contract/:tokenId')
  valuateNft(@Param('contract') contract: string, @Param('tokenId') tokenId: string) {
    return this.marketplaceService.valuateNft(tokenId, contract);
  }

  @Post('fractionalize')
  fractionalize(@Body() dto: { tokenId: string; contractAddress: string; totalShares: number }) {
    return this.fractionalService.fractionalizeNft(dto.tokenId, dto.contractAddress, dto.totalShares);
  }

  @Post('lend')
  lendNft(@Body() dto: { tokenId: string; contractAddress: string; interestRate: number; duration: number }) {
    return this.lendingService.lendNft(dto.tokenId, dto.contractAddress, dto.interestRate, dto.duration);
  }
}
