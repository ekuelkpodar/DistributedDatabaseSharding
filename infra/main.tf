terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# Placeholder: wire modules for three regions. Module implementations are intentionally omitted.
# module "vpc_use1" { source = "./modules/vpc" region = "us-east-1" }
# module "vpc_usw2" { source = "./modules/vpc" region = "us-west-2" }
# module "vpc_euw1" { source = "./modules/vpc" region = "eu-west-1" }
#
# module "s3_use1" { source = "./modules/s3" region = "us-east-1" peer_regions = ["us-west-2", "eu-west-1"] }
# module "dynamodb" { source = "./modules/dynamodb" regions = ["us-east-1", "us-west-2", "eu-west-1"] }
# module "eks_use1" { source = "./modules/eks" region = "us-east-1" }
# module "routing" { source = "./modules/routing" regions = ["us-east-1", "us-west-2", "eu-west-1"] }
