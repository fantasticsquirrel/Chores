import { FamilyApiClientCore } from "../client-core";
import type {
  BillingStatusResponse,
  HouseholdOwnershipResponse,
  TransferHouseholdOwnershipRequest,
} from "../models/account";
import type {
  AuthSessionResponse,
  ChangePasswordRequest,
  ChildLoginRequest,
  LoginRequest,
  PasswordResetConfirmRequest,
  PasswordResetConfirmResponse,
  PasswordResetRequest,
  PasswordResetRequestResponse,
  RegistrationRequest,
  RegistrationVerifyRequest,
} from "../models/auth";
import type { HealthResponse, ReadinessResponse } from "../models/common";
import type {
  CreateParentUserRequest,
  HouseholdModuleAccess,
  MyModulesResponse,
  SetHouseholdModuleAccessRequest,
  SetUserModuleAccessRequest,
  UserModuleAccess,
} from "../models/modules";

export const familyApiRoutes = {
  passwordResetRequest: "/auth/password-reset/request",
  passwordResetConfirm: "/auth/password-reset/confirm",
  householdOwnership: "/households/me/ownership",
  householdOwnershipTransfer: "/households/me/ownership/transfer",
  billing: "/billing",
} as const;

export abstract class FamilySupportApiEndpoints extends FamilyApiClientCore {
  async getHealth(): Promise<HealthResponse> {
    return this.get<HealthResponse>("/health");
  }

  async getLiveness(): Promise<HealthResponse> {
    return this.get<HealthResponse>("/health/live");
  }

  async getReadiness(): Promise<ReadinessResponse> {
    return this.get<ReadinessResponse>("/health/ready");
  }

  async login(payload: LoginRequest): Promise<AuthSessionResponse> {
    const session = await this.post<AuthSessionResponse, LoginRequest>(
      "/auth/login",
      payload,
    );
    this.afterAuthSession(session);
    return session;
  }

  async childLogin(payload: ChildLoginRequest): Promise<AuthSessionResponse> {
    const session = await this.post<AuthSessionResponse, ChildLoginRequest>(
      "/auth/child-login",
      payload,
    );
    this.afterAuthSession(session);
    return session;
  }

  async getCurrentSession(): Promise<AuthSessionResponse> {
    const session = await this.get<AuthSessionResponse>("/auth/me");
    this.afterAuthSession(session);
    return session;
  }

  async logout(): Promise<void> {
    await this.postNoContent("/auth/logout");
    this.afterLogout();
  }

  async changePassword(payload: ChangePasswordRequest): Promise<void> {
    await this.postNoContentWithBody("/auth/change-password", payload);
  }

  async requestPasswordReset(
    payload: PasswordResetRequest,
  ): Promise<PasswordResetRequestResponse> {
    return this.post<PasswordResetRequestResponse, PasswordResetRequest>(
      familyApiRoutes.passwordResetRequest,
      payload,
    );
  }

  async confirmPasswordReset(
    payload: PasswordResetConfirmRequest,
  ): Promise<PasswordResetConfirmResponse> {
    return this.post<PasswordResetConfirmResponse, PasswordResetConfirmRequest>(
      familyApiRoutes.passwordResetConfirm,
      payload,
    );
  }

  async requestRegistration(
    payload: RegistrationRequest,
  ): Promise<PasswordResetRequestResponse> {
    return this.post<PasswordResetRequestResponse, RegistrationRequest>(
      "/auth/registration/request",
      payload,
    );
  }

  async verifyRegistration(
    payload: RegistrationVerifyRequest,
  ): Promise<PasswordResetRequestResponse> {
    return this.post<PasswordResetRequestResponse, RegistrationVerifyRequest>(
      "/auth/registration/verify",
      payload,
    );
  }

  async getHouseholdOwnership(): Promise<HouseholdOwnershipResponse> {
    return this.get<HouseholdOwnershipResponse>(familyApiRoutes.householdOwnership);
  }

  async transferHouseholdOwnership(
    payload: TransferHouseholdOwnershipRequest,
  ): Promise<HouseholdOwnershipResponse> {
    return this.post<
      HouseholdOwnershipResponse,
      TransferHouseholdOwnershipRequest
    >(familyApiRoutes.householdOwnershipTransfer, payload);
  }

  async getBillingStatus(): Promise<BillingStatusResponse> {
    return this.get<BillingStatusResponse>(familyApiRoutes.billing);
  }

  async getMyModules(): Promise<MyModulesResponse> {
    return this.get<MyModulesResponse>("/modules/me");
  }

  async listHouseholdModules(): Promise<HouseholdModuleAccess[]> {
    return this.get<HouseholdModuleAccess[]>("/modules/household");
  }

  async setHouseholdModuleAccess(
    moduleKey: string,
    payload: SetHouseholdModuleAccessRequest,
  ): Promise<HouseholdModuleAccess> {
    return this.put<HouseholdModuleAccess, SetHouseholdModuleAccessRequest>(
      `/modules/household/${moduleKey}`,
      payload,
    );
  }

  async listUserModuleAccess(): Promise<UserModuleAccess[]> {
    return this.get<UserModuleAccess[]>("/modules/users");
  }

  async createParentUser(
    payload: CreateParentUserRequest,
  ): Promise<UserModuleAccess> {
    return this.post<UserModuleAccess, CreateParentUserRequest>(
      "/modules/users",
      payload,
    );
  }

  async setUserModuleAccess(
    userId: number,
    payload: SetUserModuleAccessRequest,
  ): Promise<UserModuleAccess> {
    return this.put<UserModuleAccess, SetUserModuleAccessRequest>(
      `/modules/users/${userId}`,
      payload,
    );
  }
}
