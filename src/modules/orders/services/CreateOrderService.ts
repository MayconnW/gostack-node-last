import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not registered');
    }

    const productsArray = await this.productsRepository.findAllById(
      products.map(({ id }) => ({ id })),
    );

    if (productsArray.length !== products.length) {
      throw new AppError('Invalid product in array');
    }

    const insuficientQuantity = productsArray.filter(
      item =>
        item.quantity < (products.find(i => i.id === item.id)?.quantity || 0),
    );

    if (insuficientQuantity.length > 0) {
      throw new AppError('Invalid product quantity in array');
    }

    const order = await this.ordersRepository.create({
      customer,
      products: products.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        price: productsArray.find(i => i.id === item.id)?.price || 0,
      })),
    });

    await this.productsRepository.updateQuantity(
      productsArray.map(item => ({
        id: item.id,
        quantity:
          item.quantity - (products.find(i => i.id === item.id)?.quantity || 0),
      })),
    );

    return order;
  }
}

export default CreateOrderService;
