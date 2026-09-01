import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestsApi } from '../../api/requests.api.js';
import { RequestForm } from '../../components/hospital/RequestForm.jsx';
import { PageHeader } from '../../components/common/PageHeader.jsx';
import { InfoBanner } from '../../components/common/InfoBanner.jsx';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useToast } from '../../components/common/ToastContext.jsx';

export function CreateRequestPage() {
  const [result, setResult] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();

  const handleCreate = async (payload) => {
    const data = await requestsApi.createRequest(payload);
    setResult(data);
    toast.success(`Emergency request #${data.request?.id} created successfully.`);
    if (data && data.request) {
      navigate(`/hospital/requests/${data.request.id}`);
    }
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Create Emergency Request"
        description="Broadcast an urgent red-cell requirement to verified participating blood banks in your coordination cluster."
        actions={
          <Link to="/hospital/requests" className="btn btn-secondary">
            <ArrowLeft size={16} /> Back to My Requests
          </Link>
        }
      />

      <InfoBanner variant="info">
        <strong>Coordination Protocol:</strong> This posts an emergency sourcing request to verified blood banks. It coordinates allocation hold without replacing physical delivery or laboratory cross-matching.
      </InfoBanner>

      {result && result.request && (
        <div className="form-success" role="status">
          <CheckCircle2 size={16} />
          <span>
            Emergency Request #{result.request.id} created successfully. {result.broadcast?.bankCount || 0} participating blood bank(s) notified.
          </span>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Emergency Red-Cell Details</h3>
        </div>
        <RequestForm onSubmit={handleCreate} />
      </div>
    </div>
  );
}
