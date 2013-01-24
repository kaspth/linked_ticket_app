(function() {

  return {
    childRegex: /child_of:(\d*)/,
    fatherRegex: /father_of:(\d*)/,

    events: {
      'app.activated'                   : 'onActivated',
      'ticket.status.changed'           : 'loadIfDataReady',
      'click #new-linked-ticket'        : 'displayForm',
      'click #create-linked-ticket'     : 'create',
      'createChildTicket.done'          : 'createChildTicketDone',
      'createChildTicket.fail'          : 'createChildTicketFail'
    },

    requests: {
      createChildTicket: function(ticket){
        return {
          url: '/api/v2/tickets.json',
          dataType: 'json',
          data: ticket,
          type: 'POST'
        };
      },
      updateCurrentTicket: function(data){
        return {
          url: '/api/v2/tickets/'+ this.ticket().id() +'.json',
          dataType: 'json',
          data: data,
          type: 'PUT'
        };
      }
    },

    onActivated: function(data) {
      this.doneLoading = false;

      this.ticketFields("custom_field_" + this.settings.data_field).hide();

      this.loadIfDataReady();
    },

    loadIfDataReady: function(){
      if(!this.doneLoading &&
        !!_.isEmpty(this.ticket().id())){

        if (this.hasChild())
          return this.switchTo('has_child',{ id: this.childID() });

        if (this.hasFather())
          return this.switchTo('has_father', { id: this.fatherID() });

        this.switchTo('home');
      }
    },

    displayForm: function(event){
      event.preventDefault();

      this.switchTo('form');
    },

    create: function(event){
      event.preventDefault();

      if (this.validate())
        this.ajax('createChildTicket', this.childTicketAsJson());
    },

    validate: function(){
      var fields = [ 'subject','description' ],
        isValid = true;

      _.each(fields, function(field){
        isValid = this.validateField(field, isValid);
      }, this);

      return isValid;
    },

    createChildTicketDone: function(data){
      var field = {};
      var value = "father_of:" + data.ticket.id;

      this.ticket().customField("custom_field_" + this.settings.data_field,
                                value
                               );

      field[this.settings.data_field] = value;

      this.ajax('updateCurrentTicket', { "ticket": { "fields": field }});

      this.switchTo('has_child', { id: data.ticket.id });
    },

    createChildTicketFail: function(data){
      services.notify(this.I18n.t('ticket_creation_failed'), 'error');
    },

    // Private... I guess.
    validateField: function(field){
      var fieldSelector = '#' +field,
      valid = false;

      if (_.isEmpty(this.$(fieldSelector).val())){
        this.$(fieldSelector).parent('.control-group').addClass('error');
      } else {
        this.$(fieldSelector).parent('.control-group').removeClass('error');
        valid = true;
      }
      return valid;
    },
    childTicketAsJson: function(){
      var params = {
        "subject": this.$('#subject').val(),
        "description": this.$('#subject').val(),
        "fields": {}
      };

      params.fields[this.settings.data_field] = 'child_of:' + this.ticket().id();

      if (this.$('#copy_requester').is(':checked'))
        params.requester_id = this.ticket().requester().id();

      if (this.$('#copy_description').is(':checked'))
        params.description += '\n--- Original Description --- \n' + this.ticket().description();

      return { "ticket": params };
    },
    dataField: function(){
      return this.ticket().customField("custom_field_" + this.settings.data_field);
    },
    hasChild: function(){
      return this.fatherRegex.test(this.dataField());
    },
    hasFather: function(){
      return this.childRegex.test(this.dataField());
    },
    childID: function(){
      if (!this.hasChild())
        return;

      return this.fatherRegex.exec(this.dataField())[1];
    },
    fatherID: function(){
      if (!this.hasFather())
        return;

      return this.childRegex.exec(this.dataField())[1];
    }
  };
}());
