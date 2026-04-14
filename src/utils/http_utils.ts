import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

interface RequestOptions {
  token?: string;
  config?: AxiosRequestConfig;
}

class HttpClient {
  private static instance: HttpClient;
  private client: AxiosInstance;

  private constructor() {
    this.client = axios.create();
  }

  static getInstance(): HttpClient {
    if (!HttpClient.instance) {
      HttpClient.instance = new HttpClient();
    }
    return HttpClient.instance;
  }

  private buildConfig(options?: RequestOptions): AxiosRequestConfig {
    const config: AxiosRequestConfig = { ...options?.config };
    if (options?.token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${options.token}`,
      };
    }
    return config;
  }

  async get<T = any>(
    url: string,
    options?: RequestOptions,
  ): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, this.buildConfig(options));
  }

  async post<T = any>(
    url: string,
    data?: unknown,
    options?: RequestOptions,
  ): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, this.buildConfig(options));
  }

  async put<T = any>(
    url: string,
    data?: unknown,
    options?: RequestOptions,
  ): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, this.buildConfig(options));
  }

  async patch<T = any>(
    url: string,
    data?: unknown,
    options?: RequestOptions,
  ): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, this.buildConfig(options));
  }

  async delete<T = any>(
    url: string,
    options?: RequestOptions,
  ): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, this.buildConfig(options));
  }
}

export const httpClient = HttpClient.getInstance();
