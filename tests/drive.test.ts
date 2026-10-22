import { describe, expect, it } from 'vitest';
import { driveConfigured, tokenFromRedirect } from '../src/core/drive';

describe('Google Drive backup', () => {
  it('stays off until an OAuth client ID is set', () => { expect(driveConfigured).toBe(false); });
  it('reads the access token from Google’s redirect', () => {
    expect(tokenFromRedirect('https://abc.chromiumapp.org/#access_token=ya29.x&expires_in=3599&token_type=Bearer', 1000)).toEqual({ value: 'ya29.x', expires: 1000 + 3599000 - 60000 });
  });
  it('explains a refusal or a missing token', () => {
    expect(() => tokenFromRedirect('https://abc.chromiumapp.org/#error=access_denied')).toThrow('not allowed');
    expect(() => tokenFromRedirect('https://abc.chromiumapp.org/#state=1')).toThrow('did not return');
  });
});
