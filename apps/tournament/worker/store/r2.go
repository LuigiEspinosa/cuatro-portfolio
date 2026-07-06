package store

import (
	"context"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"cs-tournament/worker/config"
)

// R2Store is the Cloudflare R2 (S3-compatible) DemoStore — the v1 primary backend. It points an
// aws-sdk-go-v2 S3 client at the R2 endpoint (region "auto", static creds, path-style). Server-side
// uploads use the manager.Uploader (streams a non-seekable body via multipart — robust for 50–170 MB);
// the admin browser upload uses a single presigned PUT (sufficient for ≤5 GB, per Task 3).
type R2Store struct {
	client   *s3.Client
	uploader *manager.Uploader
	presign  *s3.PresignClient
	bucket   string
}

var _ DemoStore = (*R2Store)(nil)

// NewR2Store builds the R2-backed store from the worker config.
func NewR2Store(cfg config.Config) *R2Store {
	client := s3.New(s3.Options{
		Region:       "auto",
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.R2AccessKeyID, cfg.R2SecretAccessKey, ""),
		BaseEndpoint: aws.String(cfg.R2S3Endpoint),
		UsePathStyle: true,
	})
	return &R2Store{
		client:   client,
		uploader: manager.NewUploader(client),
		presign:  s3.NewPresignClient(client),
		bucket:   cfg.R2Bucket,
	}
}

// Backend implements DemoStore.
func (s *R2Store) Backend() StorageBackend { return BackendR2 }

// Put streams the demo bytes to R2 via the multipart uploader (does not buffer the whole body).
func (s *R2Store) Put(ctx context.Context, key string, r io.Reader, _ int64) error {
	_, err := s.uploader.Upload(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
		Body:   r,
	})
	if err != nil {
		return fmt.Errorf("r2 put %q: %w", key, err)
	}
	return nil
}

// PresignPut mints a presigned PUT URL the browser uploads to directly (bypassing Vercel).
func (s *R2Store) PresignPut(ctx context.Context, key string, expiry time.Duration) (string, error) {
	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}, s3.WithPresignExpires(expiry))
	if err != nil {
		return "", fmt.Errorf("r2 presign put %q: %w", key, err)
	}
	return req.URL, nil
}

// Get opens the stored object for the AD-1 re-hash round-trip.
func (s *R2Store) Get(ctx context.Context, key string) (io.ReadCloser, error) {
	out, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("r2 get %q: %w", key, err)
	}
	return out.Body, nil
}

// Delete removes an object after the shared retention guard (refuses permanent_seed unless force).
func (s *R2Store) Delete(ctx context.Context, key, retentionClass string, force bool) error {
	if err := guardDelete(retentionClass, force); err != nil {
		return err
	}
	if _, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}); err != nil {
		return fmt.Errorf("r2 delete %q: %w", key, err)
	}
	return nil
}
